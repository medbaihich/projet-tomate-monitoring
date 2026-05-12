from pathlib import Path

import numpy as np
import pandas as pd


REQUIRED_METADATA_COLUMNS = {
    "sample_id",
    "label",
    "organ",
    "image_path_final",
    "original_label",
    "source",
    "split",
}


def ensure_file_exists(path: Path, description: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_embeddings(path: Path, organ_name: str) -> np.ndarray:
    ensure_file_exists(path, f"{organ_name} embeddings")

    embeddings = np.load(path)

    if embeddings.ndim != 2:
        raise ValueError(
            f"{organ_name} embeddings must be a 2D array, got shape={embeddings.shape}"
        )

    if embeddings.dtype != np.float32:
        print(
            f"[WARN] {organ_name} embeddings dtype is {embeddings.dtype}; converting to float32"
        )
        embeddings = embeddings.astype(np.float32)

    return np.ascontiguousarray(embeddings)


def load_metadata(path: Path, organ_name: str) -> pd.DataFrame:
    ensure_file_exists(path, f"{organ_name} metadata")

    metadata = pd.read_csv(path)
    missing_columns = sorted(REQUIRED_METADATA_COLUMNS - set(metadata.columns))

    if missing_columns:
        raise ValueError(
            f"{organ_name} metadata is missing required columns: {missing_columns}"
        )

    return metadata


def validate_row_count(
    embeddings: np.ndarray,
    metadata: pd.DataFrame,
    organ_name: str,
) -> None:
    if embeddings.shape[0] != len(metadata):
        raise ValueError(
            f"{organ_name} row mismatch: {embeddings.shape[0]} embeddings vs "
            f"{len(metadata)} metadata rows"
        )


def validate_feature_dimensions(
    first_embeddings: np.ndarray,
    second_embeddings: np.ndarray,
    first_name: str,
    second_name: str,
) -> None:
    if first_embeddings.shape[1] != second_embeddings.shape[1]:
        raise ValueError(
            f"Feature dimension mismatch: {first_name} has {first_embeddings.shape[1]}, "
            f"{second_name} has {second_embeddings.shape[1]}"
        )


def compute_l2_norms(embeddings: np.ndarray) -> np.ndarray:
    return np.linalg.norm(embeddings, axis=1)


def print_norm_stats(embeddings: np.ndarray, organ_name: str) -> None:
    norms = compute_l2_norms(embeddings)
    print(
        f"[INFO] {organ_name} norm stats: "
        f"min={norms.min():.6f}, max={norms.max():.6f}, "
        f"mean={norms.mean():.6f}, std={norms.std():.6f}"
    )


def l2_normalize_rows(embeddings: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)

    if np.any(norms <= eps):
        zero_count = int(np.sum(norms <= eps))
        raise ValueError(f"Cannot normalize embeddings: found {zero_count} zero-norm rows")

    normalized = embeddings / norms
    return np.ascontiguousarray(normalized.astype(np.float32))


def ensure_l2_normalized(
    embeddings: np.ndarray,
    organ_name: str,
    atol: float = 1e-3,
) -> np.ndarray:
    norms = compute_l2_norms(embeddings)

    if np.allclose(norms, 1.0, atol=atol):
        print(f"[INFO] {organ_name} embeddings are already L2-normalized")
        return np.ascontiguousarray(embeddings.astype(np.float32))

    print(f"[INFO] {organ_name} embeddings are not normalized; applying L2 normalization")
    normalized = l2_normalize_rows(embeddings)
    return normalized


def build_organ_metadata(
    fruit_metadata: pd.DataFrame,
    leaf_metadata: pd.DataFrame,
) -> pd.DataFrame:
    fruit_part = fruit_metadata.copy()
    fruit_part["organ"] = "fruit"
    fruit_part["embedding_source"] = "fruit_embeddings"
    fruit_part["embedding_row_index"] = np.arange(len(fruit_part), dtype=np.int64)

    leaf_part = leaf_metadata.copy()
    leaf_part["organ"] = "leaf"
    leaf_part["embedding_source"] = "leaf_embeddings"
    leaf_part["embedding_row_index"] = np.arange(len(leaf_part), dtype=np.int64)

    organ_metadata = pd.concat([fruit_part, leaf_part], ignore_index=True)
    organ_metadata.insert(0, "organ_index_id", np.arange(len(organ_metadata), dtype=np.int64))
    return organ_metadata
