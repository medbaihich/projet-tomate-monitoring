import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

import cv2
import numpy as np
import pandas as pd
import tensorflow as tf
import faiss

from config import (
    IMAGE_SIZE,
    FRUIT_FAISS_INDEX,
    LEAF_FAISS_INDEX,
    FRUIT_METADATA_CSV,
    LEAF_METADATA_CSV,
)

# =========================
# Model setup
# =========================
preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input

model = tf.keras.applications.MobileNetV2(
    weights="imagenet",
    include_top=False,
    pooling="avg",
    input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3),
)

# =========================
# Helpers
# =========================
def load_and_preprocess_image(image_path: str, image_size=IMAGE_SIZE):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, image_size, interpolation=cv2.INTER_AREA)
    img = img.astype(np.float32)
    img = preprocess_input(img)
    return img

def l2_normalize(vectors: np.ndarray, eps: float = 1e-10) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return vectors / norms

def extract_embedding(image_path: str) -> np.ndarray:
    img = load_and_preprocess_image(image_path)
    batch = np.expand_dims(img, axis=0).astype(np.float32)

    embedding = model(batch, training=False).numpy().astype(np.float32)
    embedding = l2_normalize(embedding)
    return embedding

def get_resources(organ: str):
    organ = organ.lower().strip()

    if organ == "fruit":
        index_path = FRUIT_FAISS_INDEX
        metadata_path = FRUIT_METADATA_CSV
    elif organ == "leaf":
        index_path = LEAF_FAISS_INDEX
        metadata_path = LEAF_METADATA_CSV
    else:
        raise ValueError("organ must be either 'fruit' or 'leaf'")

    index = faiss.read_index(str(index_path))
    metadata = pd.read_csv(metadata_path)
    return index, metadata

def search_image(query_image_path: str, organ: str, top_k: int = 5):
    index, metadata = get_resources(organ)
    query_embedding = extract_embedding(query_image_path)

    scores, indices = index.search(query_embedding, top_k)

    scores = scores[0]
    indices = indices[0]

    results = []
    for rank, (score, idx) in enumerate(zip(scores, indices), start=1):
        if idx < 0 or idx >= len(metadata):
            continue

        row = metadata.iloc[idx]

        results.append({
            "rank": rank,
            "score": float(score),
            "label": row["label"],
            "source": row["source"],
            "image_path_final": row["image_path_final"],
            "original_label": row["original_label"],
            "split": row["split"],
        })

    return results

def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print("python scripts/search_query.py <image_path> <organ> [top_k]")
        print("Example:")
        print(r'python scripts/search_query.py "C:\path\to\image.jpg" fruit 5')
        return

    query_image_path = sys.argv[1]
    organ = sys.argv[2]
    top_k = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    results = search_image(query_image_path, organ, top_k)

    print("\n===== SEARCH RESULTS =====")
    print(f"Query image: {query_image_path}")
    print(f"Organ: {organ}")
    print(f"Top K: {top_k}\n")

    for res in results:
        print(f"Rank #{res['rank']}")
        print(f"  Score         : {res['score']:.4f}")
        print(f"  Label         : {res['label']}")
        print(f"  Original Label: {res['original_label']}")
        print(f"  Source        : {res['source']}")
        print(f"  Split         : {res['split']}")
        print(f"  Image Path    : {res['image_path_final']}")
        print("-" * 60)

if __name__ == "__main__":
    main()