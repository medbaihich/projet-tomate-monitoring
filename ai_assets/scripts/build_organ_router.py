import faiss
import numpy as np

from config import (
    FRUIT_EMBEDDINGS_NPY,
    FRUIT_METADATA_CSV,
    INDEXES_DIR,
    LEAF_EMBEDDINGS_NPY,
    LEAF_METADATA_CSV,
    METADATA_DIR,
    ORGAN_FAISS_INDEX,
    ORGAN_METADATA_CSV,
)
from organ_router_utils import (
    build_organ_metadata,
    ensure_l2_normalized,
    ensure_parent_dir,
    load_embeddings,
    load_metadata,
    print_norm_stats,
    validate_feature_dimensions,
    validate_row_count,
)


def main() -> None:
    print("===== BUILD ORGAN ROUTER =====")

    INDEXES_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

    fruit_embeddings = load_embeddings(FRUIT_EMBEDDINGS_NPY, "fruit")
    leaf_embeddings = load_embeddings(LEAF_EMBEDDINGS_NPY, "leaf")

    print(f"[INFO] fruit embeddings shape={fruit_embeddings.shape}, dtype={fruit_embeddings.dtype}")
    print(f"[INFO] leaf embeddings shape={leaf_embeddings.shape}, dtype={leaf_embeddings.dtype}")

    validate_feature_dimensions(fruit_embeddings, leaf_embeddings, "fruit", "leaf")

    fruit_metadata = load_metadata(FRUIT_METADATA_CSV, "fruit")
    leaf_metadata = load_metadata(LEAF_METADATA_CSV, "leaf")

    validate_row_count(fruit_embeddings, fruit_metadata, "fruit")
    validate_row_count(leaf_embeddings, leaf_metadata, "leaf")

    print_norm_stats(fruit_embeddings, "fruit")
    print_norm_stats(leaf_embeddings, "leaf")

    fruit_embeddings = ensure_l2_normalized(fruit_embeddings, "fruit")
    leaf_embeddings = ensure_l2_normalized(leaf_embeddings, "leaf")

    print_norm_stats(fruit_embeddings, "fruit normalized")
    print_norm_stats(leaf_embeddings, "leaf normalized")

    organ_embeddings = np.concatenate([fruit_embeddings, leaf_embeddings], axis=0)
    organ_metadata = build_organ_metadata(fruit_metadata, leaf_metadata)

    if organ_embeddings.shape[0] != len(organ_metadata):
        raise ValueError(
            f"Organ data mismatch: {organ_embeddings.shape[0]} vectors vs "
            f"{len(organ_metadata)} metadata rows"
        )

    print(f"[INFO] organ embeddings shape={organ_embeddings.shape}, dtype={organ_embeddings.dtype}")
    print(f"[INFO] organ metadata rows={len(organ_metadata)}")
    print(f"[INFO] organ counts={organ_metadata['organ'].value_counts().to_dict()}")

    index = faiss.IndexFlatIP(organ_embeddings.shape[1])
    index.add(organ_embeddings)

    ensure_parent_dir(ORGAN_FAISS_INDEX)
    ensure_parent_dir(ORGAN_METADATA_CSV)

    temp_index_path = ORGAN_FAISS_INDEX.with_suffix(".tmp.index")
    temp_metadata_path = ORGAN_METADATA_CSV.with_suffix(".tmp.csv")

    try:
        organ_metadata.to_csv(temp_metadata_path, index=False)
        faiss.write_index(index, str(temp_index_path))

        temp_metadata_path.replace(ORGAN_METADATA_CSV)
        temp_index_path.replace(ORGAN_FAISS_INDEX)
    finally:
        if temp_metadata_path.exists():
            temp_metadata_path.unlink()
        if temp_index_path.exists():
            temp_index_path.unlink()

    print(f"[DONE] Saved organ index: {ORGAN_FAISS_INDEX}")
    print(f"[DONE] Saved organ metadata: {ORGAN_METADATA_CSV}")
    print(f"[DONE] Total indexed vectors: {index.ntotal}")


if __name__ == "__main__":
    main()
