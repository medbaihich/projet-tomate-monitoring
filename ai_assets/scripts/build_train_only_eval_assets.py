import argparse
import json
import pickle
import subprocess
import tempfile
from pathlib import Path

import faiss
import numpy as np
import pandas as pd

from config import (
    FRUIT_EMBEDDINGS_NPY,
    FRUIT_METADATA_CSV,
    LEAF_EMBEDDINGS_NPY,
    LEAF_METADATA_CSV,
    PROJECT_ROOT,
)
from organ_router_utils import (
    ensure_file_exists,
    ensure_l2_normalized,
    ensure_parent_dir,
    load_embeddings,
    print_norm_stats,
    validate_feature_dimensions,
    validate_row_count,
)


DEFAULT_SEED = 42
DEFAULT_INTERNAL_TRAIN_RATIO = 0.80
REQUIRED_METADATA_COLUMNS = {
    "sample_id",
    "label",
    "organ",
    "image_path_final",
    "original_label",
    "source",
}
LABEL_TO_ID = {
    "fruit": 0,
    "leaf": 1,
}

EVAL_ASSETS_DIR = PROJECT_ROOT / "eval_assets"
EVAL_INDEXES_DIR = EVAL_ASSETS_DIR / "indexes"
EVAL_METADATA_DIR = EVAL_ASSETS_DIR / "metadata"
EVAL_MODELS_DIR = EVAL_ASSETS_DIR / "models"

FRUIT_TRAIN_INDEX_PATH = EVAL_INDEXES_DIR / "fruit_train_faiss.index"
LEAF_TRAIN_INDEX_PATH = EVAL_INDEXES_DIR / "leaf_train_faiss.index"
FRUIT_TRAIN_METADATA_PATH = EVAL_METADATA_DIR / "fruit_train_metadata.csv"
LEAF_TRAIN_METADATA_PATH = EVAL_METADATA_DIR / "leaf_train_metadata.csv"
FRUIT_EVAL_METADATA_PATH = EVAL_METADATA_DIR / "fruit_eval_metadata.csv"
LEAF_EVAL_METADATA_PATH = EVAL_METADATA_DIR / "leaf_eval_metadata.csv"
ORGAN_CLASSIFIER_PATH = EVAL_MODELS_DIR / "organ_classifier_train.pkl"
ORGAN_CLASSIFIER_LABELS_PATH = EVAL_MODELS_DIR / "organ_classifier_labels.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build train-only evaluation FAISS assets and full eval metadata under "
            "eval_assets/ without modifying the current baseline indexes."
        )
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"Random seed for internal splitting and classifier training. Default: {DEFAULT_SEED}",
    )
    parser.add_argument(
        "--internal-train-ratio",
        type=float,
        default=DEFAULT_INTERNAL_TRAIN_RATIO,
        help=(
            "Train ratio used when a label does not have usable train rows. "
            f"Default: {DEFAULT_INTERNAL_TRAIN_RATIO:.2f}"
        ),
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing eval_assets outputs if they already exist.",
    )
    return parser.parse_args()


def validate_arguments(args: argparse.Namespace) -> None:
    if not 0.0 < args.internal_train_ratio < 1.0:
        raise ValueError("--internal-train-ratio must be between 0.0 and 1.0")


def validate_finite_embeddings(embeddings: np.ndarray, organ_name: str) -> None:
    if not np.isfinite(embeddings).all():
        raise ValueError(f"{organ_name} embeddings contain NaN or Inf values")


def check_output_paths(overwrite: bool) -> None:
    output_paths = [
        FRUIT_TRAIN_INDEX_PATH,
        LEAF_TRAIN_INDEX_PATH,
        FRUIT_TRAIN_METADATA_PATH,
        LEAF_TRAIN_METADATA_PATH,
        FRUIT_EVAL_METADATA_PATH,
        LEAF_EVAL_METADATA_PATH,
        ORGAN_CLASSIFIER_PATH,
        ORGAN_CLASSIFIER_LABELS_PATH,
    ]
    existing_paths = [path for path in output_paths if path.exists()]

    if existing_paths and not overwrite:
        existing_paths_text = ", ".join(str(path) for path in existing_paths)
        raise FileExistsError(
            "Eval assets already exist. Use --overwrite to replace them: "
            f"{existing_paths_text}"
        )


def load_metadata_flexible(path: Path, organ_name: str) -> pd.DataFrame:
    ensure_file_exists(path, f"{organ_name} metadata")
    metadata = pd.read_csv(path)

    missing_columns = sorted(REQUIRED_METADATA_COLUMNS - set(metadata.columns))
    if missing_columns:
        raise ValueError(
            f"{organ_name} metadata is missing required columns: {missing_columns}"
        )

    return metadata


def normalize_split_series(metadata: pd.DataFrame) -> pd.Series:
    if "split" not in metadata.columns:
        return pd.Series(["<missing>"] * len(metadata), index=metadata.index, dtype="object")

    split_values = metadata["split"].fillna("").astype(str).str.strip().str.lower()
    split_values = split_values.replace("", "<empty>")
    return split_values


def get_split_counts(metadata: pd.DataFrame) -> dict[str, int]:
    split_values = normalize_split_series(metadata)
    counts = split_values.value_counts(dropna=False).sort_index().to_dict()
    return {str(key): int(value) for key, value in counts.items()}


def compute_internal_train_count(class_size: int, train_ratio: float) -> int:
    if class_size <= 1:
        return class_size

    requested = int(round(class_size * train_ratio))
    requested = max(1, requested)
    requested = min(class_size - 1, requested)
    return requested


def assign_internal_split_for_indices(
    row_indices: np.ndarray,
    train_ratio: float,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    if len(row_indices) == 0:
        return np.array([], dtype=np.int64), np.array([], dtype=np.int64)

    shuffled = rng.permutation(row_indices)
    train_count = compute_internal_train_count(len(row_indices), train_ratio)
    train_indices = np.sort(shuffled[:train_count].astype(np.int64))
    test_indices = np.sort(shuffled[train_count:].astype(np.int64))
    return train_indices, test_indices


def build_eval_metadata_for_organ(
    metadata: pd.DataFrame,
    organ_name: str,
    train_ratio: float,
    rng: np.random.Generator,
) -> tuple[pd.DataFrame, list[str]]:
    print(f"[INFO] {organ_name} original split counts: {get_split_counts(metadata)}")

    eval_metadata = metadata.copy()
    eval_metadata.insert(0, "source_row_id", np.arange(len(eval_metadata), dtype=np.int64))
    eval_metadata["eval_split"] = ""
    eval_metadata["eval_split_source"] = ""

    split_values = normalize_split_series(eval_metadata)
    labels_missing_train_before_fix: list[str] = []

    for label_name in sorted(eval_metadata["label"].astype(str).unique()):
        label_mask = eval_metadata["label"].astype(str) == label_name
        label_indices = eval_metadata.index[label_mask].to_numpy(dtype=np.int64)
        label_splits = split_values.loc[label_indices]

        existing_train_indices = label_indices[label_splits.to_numpy() == "train"]
        existing_test_like_indices = label_indices[
            np.isin(label_splits.to_numpy(), ["test", "valid"])
        ]
        unsplit_like_indices = np.setdiff1d(
            label_indices,
            np.concatenate([existing_train_indices, existing_test_like_indices]),
            assume_unique=False,
        ).astype(np.int64)

        if len(existing_train_indices) > 0:
            eval_metadata.loc[existing_train_indices, "eval_split"] = "train"
            eval_metadata.loc[existing_train_indices, "eval_split_source"] = "existing_split"

            eval_metadata.loc[existing_test_like_indices, "eval_split"] = "test"
            eval_metadata.loc[existing_test_like_indices, "eval_split_source"] = "existing_split"

            generated_train_indices, generated_test_indices = assign_internal_split_for_indices(
                unsplit_like_indices,
                train_ratio,
                rng,
            )
            if len(generated_train_indices) > 0:
                eval_metadata.loc[generated_train_indices, "eval_split"] = "train"
                eval_metadata.loc[
                    generated_train_indices,
                    "eval_split_source",
                ] = "generated_internal_split"
            if len(generated_test_indices) > 0:
                eval_metadata.loc[generated_test_indices, "eval_split"] = "test"
                eval_metadata.loc[
                    generated_test_indices,
                    "eval_split_source",
                ] = "generated_internal_split"
            continue

        labels_missing_train_before_fix.append(label_name)
        generated_train_indices, generated_test_indices = assign_internal_split_for_indices(
            label_indices,
            train_ratio,
            rng,
        )
        if len(generated_train_indices) > 0:
            eval_metadata.loc[generated_train_indices, "eval_split"] = "train"
            eval_metadata.loc[
                generated_train_indices,
                "eval_split_source",
            ] = "generated_internal_split"
        if len(generated_test_indices) > 0:
            eval_metadata.loc[generated_test_indices, "eval_split"] = "test"
            eval_metadata.loc[
                generated_test_indices,
                "eval_split_source",
            ] = "generated_internal_split"

    if (eval_metadata["eval_split"] == "").any():
        missing_count = int((eval_metadata["eval_split"] == "").sum())
        raise ValueError(f"{organ_name} eval metadata has {missing_count} rows without eval_split")

    if (eval_metadata["eval_split_source"] == "").any():
        missing_count = int((eval_metadata["eval_split_source"] == "").sum())
        raise ValueError(
            f"{organ_name} eval metadata has {missing_count} rows without eval_split_source"
        )

    eval_metadata = eval_metadata.sort_values("source_row_id").reset_index(drop=True)
    return eval_metadata, labels_missing_train_before_fix


def build_train_subset_from_eval_metadata(
    embeddings: np.ndarray,
    eval_metadata: pd.DataFrame,
    organ_name: str,
) -> tuple[np.ndarray, pd.DataFrame]:
    train_metadata = (
        eval_metadata.loc[eval_metadata["eval_split"] == "train"]
        .copy()
        .sort_values("source_row_id")
        .reset_index(drop=True)
    )

    if train_metadata.empty:
        raise ValueError(f"{organ_name} train subset is empty after eval_split assignment")

    source_row_ids = train_metadata["source_row_id"].to_numpy(dtype=np.int64)
    train_embeddings = np.ascontiguousarray(embeddings[source_row_ids].astype(np.float32))

    if len(train_metadata) != train_embeddings.shape[0]:
        raise ValueError(
            f"{organ_name} train subset mismatch: {len(train_metadata)} metadata rows vs "
            f"{train_embeddings.shape[0]} vectors"
        )

    return train_embeddings, train_metadata


def save_metadata(metadata: pd.DataFrame, output_path: Path) -> None:
    ensure_parent_dir(output_path)
    temp_output_path = output_path.with_suffix(".tmp.csv")

    try:
        metadata.to_csv(temp_output_path, index=False)
        temp_output_path.replace(output_path)
    finally:
        if temp_output_path.exists():
            temp_output_path.unlink()


def save_index(embeddings: np.ndarray, index_path: Path) -> None:
    ensure_parent_dir(index_path)
    temp_index_path = index_path.with_suffix(".tmp.index")

    try:
        index = faiss.IndexFlatIP(int(embeddings.shape[1]))
        index.add(np.ascontiguousarray(embeddings.astype(np.float32)))
        faiss.write_index(index, str(temp_index_path))
        temp_index_path.replace(index_path)
    finally:
        if temp_index_path.exists():
            temp_index_path.unlink()


def save_labels_json(labels_path: Path) -> None:
    labels_payload = {
        "label_to_id": LABEL_TO_ID,
        "id_to_label": {str(label_id): label for label, label_id in LABEL_TO_ID.items()},
    }

    with labels_path.open("w", encoding="utf-8") as labels_file:
        json.dump(labels_payload, labels_file, indent=2)


def train_classifier_direct(X_train: np.ndarray, y_train: np.ndarray, seed: int):
    from sklearn.linear_model import LogisticRegression

    classifier = LogisticRegression(
        class_weight="balanced",
        max_iter=2000,
        random_state=seed,
    )
    classifier.fit(X_train, y_train)
    return classifier


def train_classifier_subprocess(
    X_train: np.ndarray,
    y_train: np.ndarray,
    seed: int,
    temp_model_path: Path,
    temp_labels_path: Path,
) -> None:
    helper_script = """
import json
import pickle
import sys
import numpy as np
from sklearn.linear_model import LogisticRegression

data_path = sys.argv[1]
seed = int(sys.argv[2])
model_path = sys.argv[3]
labels_path = sys.argv[4]

payload = np.load(data_path)
X_train = payload["X_train"].astype(np.float32)
y_train = payload["y_train"].astype(np.int64)

classifier = LogisticRegression(
    class_weight="balanced",
    max_iter=2000,
    random_state=seed,
)
classifier.fit(X_train, y_train)

with open(model_path, "wb") as model_file:
    pickle.dump(classifier, model_file)

labels_payload = {
    "label_to_id": {"fruit": 0, "leaf": 1},
    "id_to_label": {"0": "fruit", "1": "leaf"},
}
with open(labels_path, "w", encoding="utf-8") as labels_file:
    json.dump(labels_payload, labels_file, indent=2)
""".strip()

    temp_npz_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".npz",
            delete=False,
            dir=str(PROJECT_ROOT),
        ) as temp_file:
            temp_npz_path = Path(temp_file.name)

        np.savez(
            temp_npz_path,
            X_train=X_train.astype(np.float32),
            y_train=y_train.astype(np.int64),
        )
        result = subprocess.run(
            [
                "python",
                "-c",
                helper_script,
                str(temp_npz_path),
                str(seed),
                str(temp_model_path),
                str(temp_labels_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            print(result.stdout.strip())
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Could not run fallback system python for organ classifier training."
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr_text = exc.stderr.strip() if exc.stderr else "no stderr"
        raise RuntimeError(
            "Fallback organ classifier training failed in system python: "
            f"{stderr_text}"
        ) from exc
    finally:
        if temp_npz_path is not None and temp_npz_path.exists():
            temp_npz_path.unlink()


def train_and_save_classifier(X_train: np.ndarray, y_train: np.ndarray, seed: int) -> None:
    ensure_parent_dir(ORGAN_CLASSIFIER_PATH)
    ensure_parent_dir(ORGAN_CLASSIFIER_LABELS_PATH)

    temp_model_path = ORGAN_CLASSIFIER_PATH.with_suffix(".tmp.pkl")
    temp_labels_path = ORGAN_CLASSIFIER_LABELS_PATH.with_suffix(".tmp.json")

    try:
        try:
            classifier = train_classifier_direct(X_train, y_train, seed)
            with temp_model_path.open("wb") as model_file:
                pickle.dump(classifier, model_file)
            save_labels_json(temp_labels_path)
        except (ModuleNotFoundError, ImportError):
            train_classifier_subprocess(
                X_train=X_train,
                y_train=y_train,
                seed=seed,
                temp_model_path=temp_model_path,
                temp_labels_path=temp_labels_path,
            )

        temp_model_path.replace(ORGAN_CLASSIFIER_PATH)
        temp_labels_path.replace(ORGAN_CLASSIFIER_LABELS_PATH)
    finally:
        if temp_model_path.exists():
            temp_model_path.unlink()
        if temp_labels_path.exists():
            temp_labels_path.unlink()


def print_label_counts(metadata: pd.DataFrame, title: str) -> None:
    counts = metadata["label"].astype(str).value_counts().sort_index().to_dict()
    counts = {str(key): int(value) for key, value in counts.items()}
    print(f"{title}: {counts}")


def print_eval_split_counts(metadata: pd.DataFrame, organ_name: str) -> None:
    counts = metadata["eval_split"].astype(str).value_counts().sort_index().to_dict()
    counts = {str(key): int(value) for key, value in counts.items()}
    print(f"[INFO] {organ_name} final eval_split counts: {counts}")


def main() -> None:
    args = parse_args()
    validate_arguments(args)
    rng = np.random.default_rng(args.seed)

    print("===== BUILD TRAIN-ONLY EVAL ASSETS =====")
    check_output_paths(args.overwrite)

    fruit_embeddings = load_embeddings(FRUIT_EMBEDDINGS_NPY, "fruit")
    leaf_embeddings = load_embeddings(LEAF_EMBEDDINGS_NPY, "leaf")

    validate_feature_dimensions(fruit_embeddings, leaf_embeddings, "fruit", "leaf")
    validate_finite_embeddings(fruit_embeddings, "fruit")
    validate_finite_embeddings(leaf_embeddings, "leaf")

    fruit_metadata = load_metadata_flexible(FRUIT_METADATA_CSV, "fruit")
    leaf_metadata = load_metadata_flexible(LEAF_METADATA_CSV, "leaf")

    validate_row_count(fruit_embeddings, fruit_metadata, "fruit")
    validate_row_count(leaf_embeddings, leaf_metadata, "leaf")

    print(f"[INFO] fruit embeddings shape={fruit_embeddings.shape}, dtype={fruit_embeddings.dtype}")
    print(f"[INFO] leaf embeddings shape={leaf_embeddings.shape}, dtype={leaf_embeddings.dtype}")

    print_norm_stats(fruit_embeddings, "fruit")
    print_norm_stats(leaf_embeddings, "leaf")

    fruit_embeddings = ensure_l2_normalized(fruit_embeddings, "fruit")
    leaf_embeddings = ensure_l2_normalized(leaf_embeddings, "leaf")

    print_norm_stats(fruit_embeddings, "fruit normalized")
    print_norm_stats(leaf_embeddings, "leaf normalized")

    fruit_eval_metadata, fruit_missing_labels = build_eval_metadata_for_organ(
        metadata=fruit_metadata,
        organ_name="fruit",
        train_ratio=args.internal_train_ratio,
        rng=rng,
    )
    leaf_eval_metadata, leaf_missing_labels = build_eval_metadata_for_organ(
        metadata=leaf_metadata,
        organ_name="leaf",
        train_ratio=args.internal_train_ratio,
        rng=rng,
    )

    print(f"[INFO] fruit labels missing train before fix: {fruit_missing_labels}")
    print(f"[INFO] leaf labels missing train before fix: {leaf_missing_labels}")

    fruit_train_embeddings, fruit_train_metadata = build_train_subset_from_eval_metadata(
        embeddings=fruit_embeddings,
        eval_metadata=fruit_eval_metadata,
        organ_name="fruit",
    )
    leaf_train_embeddings, leaf_train_metadata = build_train_subset_from_eval_metadata(
        embeddings=leaf_embeddings,
        eval_metadata=leaf_eval_metadata,
        organ_name="leaf",
    )

    feature_dim = int(fruit_train_embeddings.shape[1])

    save_index(fruit_train_embeddings, FRUIT_TRAIN_INDEX_PATH)
    save_index(leaf_train_embeddings, LEAF_TRAIN_INDEX_PATH)
    save_metadata(fruit_train_metadata, FRUIT_TRAIN_METADATA_PATH)
    save_metadata(leaf_train_metadata, LEAF_TRAIN_METADATA_PATH)
    save_metadata(fruit_eval_metadata, FRUIT_EVAL_METADATA_PATH)
    save_metadata(leaf_eval_metadata, LEAF_EVAL_METADATA_PATH)

    X_train = np.concatenate([fruit_train_embeddings, leaf_train_embeddings], axis=0).astype(np.float32)
    y_train = np.concatenate(
        [
            np.full(len(fruit_train_embeddings), LABEL_TO_ID["fruit"], dtype=np.int64),
            np.full(len(leaf_train_embeddings), LABEL_TO_ID["leaf"], dtype=np.int64),
        ]
    )
    train_and_save_classifier(X_train=X_train, y_train=y_train, seed=args.seed)

    print_label_counts(fruit_train_metadata, "[INFO] fruit final train label counts")
    print_label_counts(leaf_train_metadata, "[INFO] leaf final train label counts")
    print_eval_split_counts(fruit_eval_metadata, "fruit")
    print_eval_split_counts(leaf_eval_metadata, "leaf")

    print(f"fruit_train_count: {len(fruit_train_embeddings)}")
    print(f"leaf_train_count: {len(leaf_train_embeddings)}")
    print(f"feature_dim: {feature_dim}")
    print(f"fruit_index_path: {FRUIT_TRAIN_INDEX_PATH}")
    print(f"leaf_index_path: {LEAF_TRAIN_INDEX_PATH}")
    print(f"fruit_train_metadata_path: {FRUIT_TRAIN_METADATA_PATH}")
    print(f"leaf_train_metadata_path: {LEAF_TRAIN_METADATA_PATH}")
    print(f"fruit_eval_metadata_path: {FRUIT_EVAL_METADATA_PATH}")
    print(f"leaf_eval_metadata_path: {LEAF_EVAL_METADATA_PATH}")
    print(f"classifier_path: {ORGAN_CLASSIFIER_PATH}")
    print(f"labels_path: {ORGAN_CLASSIFIER_LABELS_PATH}")


if __name__ == "__main__":
    main()
