import os
import argparse
from pathlib import Path

import cv2
import faiss
import numpy as np
import pandas as pd
from absl import logging as absl_logging

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import tensorflow as tf

from config import IMAGE_SIZE, PROJECT_ROOT


EXPECTED_FEATURE_DIM = 1280
DEFAULT_TOP_K = 7
DEFAULT_MIN_VOTE_RATIO = 0.60
NORM_ATOL = 1e-3


preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input
tf.get_logger().setLevel("ERROR")
absl_logging.set_verbosity(absl_logging.ERROR)
absl_logging.set_stderrthreshold("error")

model = tf.keras.applications.MobileNetV2(
    weights="imagenet",
    include_top=False,
    pooling="avg",
    input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the FAISS organ router on a single local tomato image."
    )
    parser.add_argument("--image", required=True, help="Path to the local image file.")
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help=f"Number of FAISS neighbors to inspect. Default: {DEFAULT_TOP_K}",
    )
    parser.add_argument(
        "--min-vote-ratio",
        type=float,
        default=DEFAULT_MIN_VOTE_RATIO,
        help=(
            "Minimum majority ratio required to return fruit or leaf. "
            f"Default: {DEFAULT_MIN_VOTE_RATIO:.2f}"
        ),
    )
    parser.add_argument(
        "--assets-dir",
        default=str(PROJECT_ROOT),
        help="Project root that contains indexes/ and metadata/. Default: project root.",
    )
    parser.add_argument(
        "--show-neighbors",
        action="store_true",
        help="Print the top-k organ neighbors after routing.",
    )
    return parser.parse_args()


def ensure_file_exists(path: Path, description: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")


def l2_normalize(vectors: np.ndarray, eps: float = 1e-10) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return vectors / norms


def resolve_assets_dir(assets_dir_arg: str) -> Path:
    assets_dir = Path(assets_dir_arg).expanduser().resolve()
    if not assets_dir.exists():
        raise FileNotFoundError(f"Assets directory does not exist: {assets_dir}")
    return assets_dir


def resolve_required_paths(assets_dir: Path) -> tuple[Path, Path]:
    index_path = assets_dir / "indexes" / "organ_faiss.index"
    metadata_path = assets_dir / "metadata" / "organ_metadata.csv"

    ensure_file_exists(index_path, "organ FAISS index")
    ensure_file_exists(metadata_path, "organ metadata CSV")
    return index_path, metadata_path


def load_and_preprocess_image(image_path: Path, image_size: tuple[int, int] = IMAGE_SIZE) -> np.ndarray:
    ensure_file_exists(image_path, "input image")

    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Could not read image with OpenCV: {image_path}")

    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, image_size, interpolation=cv2.INTER_AREA)
    img = img.astype(np.float32)
    img = preprocess_input(img)
    return img


def extract_feature_vector(image_path: Path) -> np.ndarray:
    img = load_and_preprocess_image(image_path)
    batch = np.expand_dims(img, axis=0).astype(np.float32)

    vector = model(batch, training=False).numpy().astype(np.float32)
    vector = l2_normalize(vector).astype(np.float32)

    if vector.shape != (1, EXPECTED_FEATURE_DIM):
        raise ValueError(
            f"Wrong feature vector shape: expected (1, {EXPECTED_FEATURE_DIM}), got {vector.shape}"
        )

    if not np.isfinite(vector).all():
        raise ValueError("Feature vector contains NaN or Inf values")

    vector_norm = float(np.linalg.norm(vector[0]))
    if not np.isclose(vector_norm, 1.0, atol=NORM_ATOL):
        raise ValueError(f"Feature vector norm is not close to 1.0: {vector_norm:.6f}")

    return vector


def load_resources(index_path: Path, metadata_path: Path) -> tuple[faiss.Index, pd.DataFrame]:
    index = faiss.read_index(str(index_path))
    metadata = pd.read_csv(metadata_path)

    if index.ntotal != len(metadata):
        raise ValueError(
            f"Index/metadata mismatch: index.ntotal={index.ntotal} vs metadata rows={len(metadata)}"
        )

    required_columns = {"organ", "label"}
    missing_columns = sorted(required_columns - set(metadata.columns))
    if missing_columns:
        raise ValueError(f"organ metadata is missing required columns: {missing_columns}")

    return index, metadata


def search_neighbors(
    index: faiss.Index,
    metadata: pd.DataFrame,
    query_vector: np.ndarray,
    top_k: int,
) -> tuple[np.ndarray, np.ndarray]:
    if top_k <= 0:
        raise ValueError("--top-k must be a positive integer")

    if top_k > index.ntotal:
        raise ValueError(
            f"--top-k={top_k} is larger than the number of indexed vectors ({index.ntotal})"
        )

    scores, indices = index.search(query_vector, top_k)
    scores = scores[0]
    indices = indices[0]

    if len(indices) != top_k:
        raise RuntimeError(f"FAISS returned {len(indices)} neighbors, expected {top_k}")

    if np.any(indices < 0):
        raise RuntimeError("FAISS returned invalid neighbor indices")

    if np.any(indices >= len(metadata)):
        raise RuntimeError("FAISS returned neighbor indices outside metadata bounds")

    return scores, indices


def decide_organ(fruit_count: int, leaf_count: int, total_votes: int, min_vote_ratio: float) -> tuple[str, int, float]:
    if total_votes <= 0:
        raise ValueError("No neighbor votes available")

    if not 0.0 <= min_vote_ratio <= 1.0:
        raise ValueError("--min-vote-ratio must be between 0.0 and 1.0")

    winning_votes = max(fruit_count, leaf_count)
    vote_ratio = winning_votes / total_votes

    if fruit_count == leaf_count:
        return "unknown", winning_votes, vote_ratio

    if vote_ratio < min_vote_ratio:
        return "unknown", winning_votes, vote_ratio

    predicted_organ = "fruit" if fruit_count > leaf_count else "leaf"
    return predicted_organ, winning_votes, vote_ratio


def print_result(
    image_path: Path,
    query_vector: np.ndarray,
    predicted_organ: str,
    winning_votes: int,
    vote_ratio: float,
    fruit_count: int,
    leaf_count: int,
    total_votes: int,
) -> None:
    vector_norm = float(np.linalg.norm(query_vector[0]))

    print("[IMAGE FEATURE EXTRACTION]")
    print(f"image: {image_path}")
    print(f"feature_dim: {query_vector.shape[1]}")
    print(f"vector_norm: {vector_norm:.4f}")
    print()
    print("[ORGAN ROUTER]")
    print(f"predicted_organ: {predicted_organ}")
    print(f"vote: {winning_votes}/{total_votes}")
    print(f"vote_ratio: {vote_ratio:.3f}")
    print(f"fruit_count: {fruit_count}")
    print(f"leaf_count: {leaf_count}")
    print("metric: cosine_similarity_indexflatip")


def print_neighbors(metadata: pd.DataFrame, scores: np.ndarray, indices: np.ndarray) -> None:
    print()
    print("Top-k organ neighbors:")

    for rank, (score, idx) in enumerate(zip(scores, indices), start=1):
        row = metadata.iloc[int(idx)]
        source_row_id = row["organ_index_id"] if "organ_index_id" in metadata.columns else int(idx)
        organ = str(row["organ"])
        label = str(row["label"])
        print(
            f"{rank}. {organ:<5} | label={label} | score={float(score):.4f} | "
            f"source_row_id={source_row_id}"
        )


def main() -> None:
    args = parse_args()

    image_path = Path(args.image).expanduser().resolve()
    assets_dir = resolve_assets_dir(args.assets_dir)
    index_path, metadata_path = resolve_required_paths(assets_dir)

    query_vector = extract_feature_vector(image_path)
    index, metadata = load_resources(index_path, metadata_path)
    scores, indices = search_neighbors(index, metadata, query_vector, args.top_k)

    neighbor_organs = metadata.iloc[indices]["organ"].astype(str)
    fruit_count = int((neighbor_organs == "fruit").sum())
    leaf_count = int((neighbor_organs == "leaf").sum())

    predicted_organ, winning_votes, vote_ratio = decide_organ(
        fruit_count=fruit_count,
        leaf_count=leaf_count,
        total_votes=args.top_k,
        min_vote_ratio=args.min_vote_ratio,
    )

    print_result(
        image_path=image_path,
        query_vector=query_vector,
        predicted_organ=predicted_organ,
        winning_votes=winning_votes,
        vote_ratio=vote_ratio,
        fruit_count=fruit_count,
        leaf_count=leaf_count,
        total_votes=args.top_k,
    )

    if args.show_neighbors:
        print_neighbors(metadata, scores, indices)


if __name__ == "__main__":
    main()
