import argparse
import json
import pickle
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from config import (
    FRUIT_EMBEDDINGS_NPY,
    FRUIT_METADATA_CSV,
    LEAF_EMBEDDINGS_NPY,
    LEAF_METADATA_CSV,
    PROJECT_ROOT,
)
from organ_router_utils import (
    ensure_l2_normalized,
    ensure_parent_dir,
    load_embeddings,
    load_metadata,
    print_norm_stats,
    validate_feature_dimensions,
    validate_row_count,
)


DEFAULT_SEED = 42
DEFAULT_TEST_SIZE = 0.20
MODEL_OUTPUT_PATH = PROJECT_ROOT / "models" / "organ_classifier_logreg.pkl"
LABELS_OUTPUT_PATH = PROJECT_ROOT / "models" / "organ_classifier_labels.json"
LABEL_TO_ID = {
    "fruit": 0,
    "leaf": 1,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a lightweight organ classifier on the existing fruit and leaf embeddings."
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"Random seed used for balanced sampling and train/test split. Default: {DEFAULT_SEED}",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=DEFAULT_TEST_SIZE,
        help=f"Fraction of the balanced dataset reserved for testing. Default: {DEFAULT_TEST_SIZE:.2f}",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the saved model and labels if they already exist.",
    )
    return parser.parse_args()


def validate_finite_embeddings(embeddings: np.ndarray, organ_name: str) -> None:
    if not np.isfinite(embeddings).all():
        raise ValueError(f"{organ_name} embeddings contain NaN or Inf values")


def check_output_paths(overwrite: bool) -> None:
    existing_paths = [
        path
        for path in (MODEL_OUTPUT_PATH, LABELS_OUTPUT_PATH)
        if path.exists()
    ]

    if existing_paths and not overwrite:
        existing_paths_text = ", ".join(str(path) for path in existing_paths)
        raise FileExistsError(
            "Model outputs already exist. Use --overwrite to replace them: "
            f"{existing_paths_text}"
        )


def select_balanced_indices(
    num_rows: int,
    sample_size: int,
    rng: np.random.Generator,
) -> np.ndarray:
    if sample_size > num_rows:
        raise ValueError(f"Cannot sample {sample_size} rows from only {num_rows} rows")

    if sample_size == num_rows:
        return np.arange(num_rows, dtype=np.int64)

    selected = rng.choice(num_rows, size=sample_size, replace=False)
    return np.sort(selected.astype(np.int64))


def save_artifacts(model: LogisticRegression) -> None:
    ensure_parent_dir(MODEL_OUTPUT_PATH)
    ensure_parent_dir(LABELS_OUTPUT_PATH)

    temp_model_path = MODEL_OUTPUT_PATH.with_suffix(".tmp.pkl")
    temp_labels_path = LABELS_OUTPUT_PATH.with_suffix(".tmp.json")

    labels_payload = {
        "label_to_id": LABEL_TO_ID,
        "id_to_label": {str(label_id): label for label, label_id in LABEL_TO_ID.items()},
    }

    try:
        with temp_model_path.open("wb") as model_file:
            pickle.dump(model, model_file)

        with temp_labels_path.open("w", encoding="utf-8") as labels_file:
            json.dump(labels_payload, labels_file, indent=2)

        temp_model_path.replace(MODEL_OUTPUT_PATH)
        temp_labels_path.replace(LABELS_OUTPUT_PATH)
    finally:
        if temp_model_path.exists():
            temp_model_path.unlink()
        if temp_labels_path.exists():
            temp_labels_path.unlink()


def main() -> None:
    args = parse_args()
    rng = np.random.default_rng(args.seed)

    if not 0.0 < args.test_size < 1.0:
        raise ValueError("--test-size must be between 0.0 and 1.0")

    print("===== TRAIN ORGAN CLASSIFIER =====")
    check_output_paths(args.overwrite)

    fruit_embeddings = load_embeddings(FRUIT_EMBEDDINGS_NPY, "fruit")
    leaf_embeddings = load_embeddings(LEAF_EMBEDDINGS_NPY, "leaf")

    validate_feature_dimensions(fruit_embeddings, leaf_embeddings, "fruit", "leaf")
    validate_finite_embeddings(fruit_embeddings, "fruit")
    validate_finite_embeddings(leaf_embeddings, "leaf")

    fruit_metadata = load_metadata(FRUIT_METADATA_CSV, "fruit")
    leaf_metadata = load_metadata(LEAF_METADATA_CSV, "leaf")

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

    sample_size = min(len(fruit_embeddings), len(leaf_embeddings))
    fruit_indices = select_balanced_indices(len(fruit_embeddings), sample_size, rng)
    leaf_indices = select_balanced_indices(len(leaf_embeddings), sample_size, rng)

    selected_fruit = np.ascontiguousarray(fruit_embeddings[fruit_indices])
    selected_leaf = np.ascontiguousarray(leaf_embeddings[leaf_indices])

    X = np.concatenate([selected_fruit, selected_leaf], axis=0).astype(np.float32)
    y = np.concatenate([
        np.full(sample_size, LABEL_TO_ID["fruit"], dtype=np.int64),
        np.full(sample_size, LABEL_TO_ID["leaf"], dtype=np.int64),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.seed,
        stratify=y,
    )

    classifier = LogisticRegression(
        class_weight="balanced",
        max_iter=2000,
        random_state=args.seed,
    )
    classifier.fit(X_train, y_train)

    y_pred = classifier.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(
        y_test,
        y_pred,
        target_names=["fruit", "leaf"],
        digits=4,
    )
    matrix = confusion_matrix(y_test, y_pred)

    save_artifacts(classifier)

    print(f"fruit_selected_count: {len(fruit_indices)}")
    print(f"leaf_selected_count: {len(leaf_indices)}")
    print(f"combined_count: {len(X)}")
    print(f"feature_dim: {X.shape[1]}")
    print(f"train_count: {len(X_train)}")
    print(f"test_count: {len(X_test)}")
    print(f"accuracy: {accuracy:.4f}")
    print(f"model_path: {MODEL_OUTPUT_PATH}")
    print(f"labels_path: {LABELS_OUTPUT_PATH}")
    print("\n[CLASSIFICATION REPORT]")
    print(report)
    print("[CONFUSION MATRIX]")
    print(matrix)


if __name__ == "__main__":
    main()
