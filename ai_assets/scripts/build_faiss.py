import numpy as np
import pandas as pd
import faiss

from config import (
    INDEXES_DIR,
    FRUIT_EMBEDDINGS_NPY,
    LEAF_EMBEDDINGS_NPY,
    FRUIT_METADATA_CSV,
    LEAF_METADATA_CSV,
    FRUIT_FAISS_INDEX,
    LEAF_FAISS_INDEX,
)

def ensure_dirs():
    INDEXES_DIR.mkdir(parents=True, exist_ok=True)

def build_index(embeddings_path, metadata_path, index_output_path, organ_name):
    print(f"\n[INFO] Building FAISS index for organ='{organ_name}'")

    embeddings = np.load(embeddings_path).astype("float32")
    metadata = pd.read_csv(metadata_path)

    if len(metadata) != embeddings.shape[0]:
        raise ValueError(
            f"Mismatch for {organ_name}: "
            f"{len(metadata)} metadata rows vs {embeddings.shape[0]} embeddings"
        )

    dim = embeddings.shape[1]

    # بما أن embeddings normalized -> IP ~= cosine similarity
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    faiss.write_index(index, str(index_output_path))

    print(f"[DONE] organ='{organ_name}'")
    print(f"Embeddings shape: {embeddings.shape}")
    print(f"Metadata rows:    {len(metadata)}")
    print(f"Saved index:      {index_output_path}")
    print(f"Total vectors:    {index.ntotal}")

def main():
    ensure_dirs()

    build_index(
        embeddings_path=FRUIT_EMBEDDINGS_NPY,
        metadata_path=FRUIT_METADATA_CSV,
        index_output_path=FRUIT_FAISS_INDEX,
        organ_name="fruit",
    )

    build_index(
        embeddings_path=LEAF_EMBEDDINGS_NPY,
        metadata_path=LEAF_METADATA_CSV,
        index_output_path=LEAF_FAISS_INDEX,
        organ_name="leaf",
    )

    print("\n===== ALL DONE =====")

if __name__ == "__main__":
    main()