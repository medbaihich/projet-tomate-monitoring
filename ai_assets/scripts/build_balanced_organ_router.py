import argparse

import faiss
import numpy as np
import pandas as pd

from config import (
    FRUIT_EMBEDDINGS_NPY,
    FRUIT_METADATA_CSV,
    INDEXES_DIR,
    LEAF_EMBEDDINGS_NPY,
    LEAF_METADATA_CSV,
    METADATA_DIR,
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
BALANCED_ORGAN_INDEX_PATH = INDEXES_DIR / "organ_faiss_balanced.index"
BALANCED_ORGAN_METADATA_PATH = METADATA_DIR / "organ_metadata_balanced.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a balanced organ FAISS router by sampling the larger organ down to the "
            "size of the smaller organ."
        )
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"Random seed used for balanced sampling. Default: {DEFAULT_SEED}",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the balanced index and metadata outputs if they already exist.",
    )
    return parser.parse_args()


def validate_finite_embeddings(embeddings: np.ndarray, organ_name: str) -> None:
    if not np.isfinite(embeddings).all():
        raise ValueError(f"{organ_name} embeddings contain NaN or Inf values")


def check_output_paths(overwrite: bool) -> None:
    existing_paths = [
        path
        for path in (BALANCED_ORGAN_INDEX_PATH, BALANCED_ORGAN_METADATA_PATH)
        if path.exists()
    ]

    if existing_paths and not overwrite:
        existing_paths_text = ", ".join(str(path) for path in existing_paths)
        raise FileExistsError(
            "Balanced organ router outputs already exist. Use --overwrite to replace them: "
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


def build_balanced_metadata(
    metadata: pd.DataFrame,
    selected_indices: np.ndarray,
    source_embedding_name: str,
    organ_name: str,
) -> pd.DataFrame:
    selected_rows = metadata.iloc[selected_indices].copy().reset_index(drop=True)

    balanced_metadata = pd.DataFrame({
        "source_embedding": source_embedding_name,
        "source_row_id": selected_indices.astype(np.int64),
        "organ": organ_name,
        "label": selected_rows["label"].astype(str),
        "sample_id": selected_rows["sample_id"].astype(str),
        "image_path_final": selected_rows["image_path_final"].astype(str),
    })
    return balanced_metadata


def save_outputs(index: faiss.Index, metadata: pd.DataFrame) -> None:
    ensure_parent_dir(BALANCED_ORGAN_INDEX_PATH)
    ensure_parent_dir(BALANCED_ORGAN_METADATA_PATH)

    temp_index_path = BALANCED_ORGAN_INDEX_PATH.with_suffix(".tmp.index")
    temp_metadata_path = BALANCED_ORGAN_METADATA_PATH.with_suffix(".tmp.csv")

    try:
        metadata.to_csv(temp_metadata_path, index=False)
        faiss.write_index(index, str(temp_index_path))

        temp_metadata_path.replace(BALANCED_ORGAN_METADATA_PATH)
        temp_index_path.replace(BALANCED_ORGAN_INDEX_PATH)
    finally:
        if temp_metadata_path.exists():
            temp_metadata_path.unlink()
        if temp_index_path.exists():
            temp_index_path.unlink()


def main() -> None:
    args = parse_args()
    rng = np.random.default_rng(args.seed)

    print("===== BUILD BALANCED ORGAN ROUTER =====")
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

    selected_fruit_embeddings = np.ascontiguousarray(fruit_embeddings[fruit_indices])
    selected_leaf_embeddings = np.ascontiguousarray(leaf_embeddings[leaf_indices])

    fruit_balanced_metadata = build_balanced_metadata(
        metadata=fruit_metadata,
        selected_indices=fruit_indices,
        source_embedding_name=FRUIT_EMBEDDINGS_NPY.name,
        organ_name="fruit",
    )
    leaf_balanced_metadata = build_balanced_metadata(
        metadata=leaf_metadata,
        selected_indices=leaf_indices,
        source_embedding_name=LEAF_EMBEDDINGS_NPY.name,
        organ_name="leaf",
    )

    combined_embeddings = np.concatenate(
        [selected_fruit_embeddings, selected_leaf_embeddings],
        axis=0,
    ).astype(np.float32)
    combined_metadata = pd.concat(
        [fruit_balanced_metadata, leaf_balanced_metadata],
        ignore_index=True,
    )
    combined_metadata.insert(
        0,
        "organ_index_id",
        np.arange(len(combined_metadata), dtype=np.int64),
    )

    if len(combined_metadata) != combined_embeddings.shape[0]:
        raise ValueError(
            f"Balanced organ data mismatch: {len(combined_metadata)} metadata rows vs "
            f"{combined_embeddings.shape[0]} vectors"
        )

    feature_dim = combined_embeddings.shape[1]
    index = faiss.IndexFlatIP(feature_dim)
    index.add(combined_embeddings)

    save_outputs(index, combined_metadata)

    print(f"fruit_selected_count: {len(fruit_indices)}")
    print(f"leaf_selected_count: {len(leaf_indices)}")
    print(f"combined_count: {len(combined_metadata)}")
    print(f"feature_dim: {feature_dim}")
    print("index_type: IndexFlatIP")
    print(f"output_index_path: {BALANCED_ORGAN_INDEX_PATH}")
    print(f"output_metadata_path: {BALANCED_ORGAN_METADATA_PATH}")


if __name__ == "__main__":
    main()
