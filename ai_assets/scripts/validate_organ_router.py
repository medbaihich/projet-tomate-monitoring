import argparse
from typing import Iterable

import faiss
import numpy as np
import pandas as pd

from config import ORGAN_FAISS_INDEX, ORGAN_METADATA_CSV
from organ_router_utils import ensure_file_exists


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate organ FAISS routing using stored indexed embeddings."
    )
    parser.add_argument("--top-k", type=int, default=5, help="Number of neighbors to vote on.")
    parser.add_argument(
        "--count-per-organ",
        type=int,
        default=3,
        help="How many sample queries to test per organ when sample ids are not provided.",
    )
    parser.add_argument(
        "--sample-id",
        action="append",
        dest="sample_ids",
        default=None,
        help="Specific sample_id to validate. Repeat the flag to test multiple samples.",
    )
    parser.add_argument(
        "--include-self",
        action="store_true",
        help="Include the exact query vector itself in the neighbor vote.",
    )
    return parser.parse_args()


def load_resources() -> tuple[faiss.Index, pd.DataFrame]:
    ensure_file_exists(ORGAN_FAISS_INDEX, "organ FAISS index")
    ensure_file_exists(ORGAN_METADATA_CSV, "organ metadata")

    index = faiss.read_index(str(ORGAN_FAISS_INDEX))
    metadata = pd.read_csv(ORGAN_METADATA_CSV)

    if index.ntotal != len(metadata):
        raise ValueError(
            f"Index/metadata mismatch: index.ntotal={index.ntotal} vs metadata rows={len(metadata)}"
        )

    return index, metadata


def select_query_indices(metadata: pd.DataFrame, count_per_organ: int) -> list[int]:
    query_indices: list[int] = []

    for organ_name in ("fruit", "leaf"):
        organ_rows = metadata.index[metadata["organ"] == organ_name].tolist()
        if not organ_rows:
            raise ValueError(f"No rows found for organ={organ_name}")
        query_indices.extend(organ_rows[:count_per_organ])

    return query_indices


def sample_ids_to_indices(metadata: pd.DataFrame, sample_ids: Iterable[str]) -> list[int]:
    query_indices: list[int] = []

    for sample_id in sample_ids:
        matches = metadata.index[metadata["sample_id"] == sample_id].tolist()
        if not matches:
            raise ValueError(f"sample_id not found in organ metadata: {sample_id}")
        query_indices.append(matches[0])

    return query_indices


def resolve_prediction(vote_counts: pd.Series, score_sums: pd.Series) -> str:
    organ_names = sorted(vote_counts.index.tolist())
    return max(
        organ_names,
        key=lambda organ_name: (int(vote_counts[organ_name]), float(score_sums[organ_name])),
    )


def search_neighbors(
    index: faiss.Index,
    query_index: int,
    top_k: int,
    include_self: bool,
) -> tuple[np.ndarray, np.ndarray]:
    query_vector = index.reconstruct(query_index).reshape(1, -1).astype(np.float32)
    search_k = top_k if include_self else top_k + 1

    scores, indices = index.search(query_vector, search_k)
    scores = scores[0]
    indices = indices[0]

    if include_self:
        return scores[:top_k], indices[:top_k]

    filtered_scores = []
    filtered_indices = []

    for score, neighbor_index in zip(scores, indices):
        if neighbor_index == query_index:
            continue
        filtered_scores.append(float(score))
        filtered_indices.append(int(neighbor_index))
        if len(filtered_indices) == top_k:
            break

    return np.array(filtered_scores, dtype=np.float32), np.array(filtered_indices, dtype=np.int64)


def print_query_result(
    metadata: pd.DataFrame,
    query_index: int,
    scores: np.ndarray,
    indices: np.ndarray,
) -> bool:
    query_row = metadata.iloc[query_index]
    neighbor_rows = metadata.iloc[indices].copy()
    neighbor_rows["score"] = scores

    vote_counts = neighbor_rows["organ"].value_counts()
    score_sums = neighbor_rows.groupby("organ")["score"].sum()
    predicted_organ = resolve_prediction(vote_counts, score_sums)
    expected_organ = str(query_row["organ"])
    is_correct = predicted_organ == expected_organ

    print("\n" + "=" * 72)
    print(
        f"Query sample_id={query_row['sample_id']} | expected organ={expected_organ} | "
        f"predicted organ={predicted_organ} | correct={is_correct}"
    )
    print(
        f"Label={query_row['label']} | source={query_row['source']} | "
        f"image={query_row['image_path_final']}"
    )
    print(f"Vote counts={vote_counts.to_dict()} | score sums={score_sums.round(4).to_dict()}")
    print("-" * 72)

    for rank, (score, neighbor_index) in enumerate(zip(scores, indices), start=1):
        row = metadata.iloc[neighbor_index]
        print(
            f"#{rank} score={score:.4f} organ={row['organ']} label={row['label']} "
            f"sample_id={row['sample_id']} source={row['source']}"
        )

    return is_correct


def main() -> None:
    args = parse_args()

    if args.top_k <= 0:
        raise ValueError("--top-k must be a positive integer")

    if args.count_per_organ <= 0:
        raise ValueError("--count-per-organ must be a positive integer")

    print("===== VALIDATE ORGAN ROUTER =====")
    print(
        f"[INFO] top_k={args.top_k} | include_self={args.include_self} | "
        f"count_per_organ={args.count_per_organ}"
    )

    index, metadata = load_resources()
    print(f"[INFO] Loaded organ index with ntotal={index.ntotal}")
    print(f"[INFO] Loaded organ metadata rows={len(metadata)}")
    print(f"[INFO] Organ distribution={metadata['organ'].value_counts().to_dict()}")

    if args.sample_ids:
        query_indices = sample_ids_to_indices(metadata, args.sample_ids)
    else:
        query_indices = select_query_indices(metadata, args.count_per_organ)

    correct = 0

    for query_index in query_indices:
        scores, indices = search_neighbors(index, query_index, args.top_k, args.include_self)
        if len(indices) < args.top_k:
            raise ValueError(
                f"Could not collect {args.top_k} neighbors for query index {query_index}"
            )
        correct += int(print_query_result(metadata, query_index, scores, indices))

    total = len(query_indices)
    accuracy = correct / total if total else 0.0

    print("\n" + "=" * 72)
    print(f"Validation summary: {correct}/{total} correct ({accuracy:.2%})")


if __name__ == "__main__":
    main()
