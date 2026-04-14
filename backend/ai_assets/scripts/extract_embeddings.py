import math
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import tensorflow as tf

from config import (
    FINAL_METADATA_CSV,
    EMBEDDINGS_DIR,
    METADATA_DIR,
    FRUIT_EMBEDDINGS_NPY,
    LEAF_EMBEDDINGS_NPY,
    FRUIT_METADATA_CSV,
    LEAF_METADATA_CSV,
    IMAGE_SIZE,
    BATCH_SIZE,
)

# =========================
# TensorFlow / MobileNetV2 setup
# =========================
tf.get_logger().setLevel("ERROR")

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
def ensure_dirs():
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

def load_and_preprocess_image(image_path: str, image_size=IMAGE_SIZE):
    """
    Reads image with OpenCV, converts BGR->RGB,
    resizes to MobileNetV2 input size,
    and applies preprocess_input.
    Returns float32 numpy array with shape (H, W, 3)
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, image_size, interpolation=cv2.INTER_AREA)
    img = img.astype(np.float32)
    img = preprocess_input(img)  # expects pixels scaled appropriately for MobileNetV2
    return img

def l2_normalize(vectors: np.ndarray, eps: float = 1e-10) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return vectors / norms

def process_subset(df_subset: pd.DataFrame, organ_name: str, output_npy: Path, output_csv: Path):
    """
    Extract embeddings for one organ (fruit or leaf),
    save .npy embeddings and matching metadata CSV.
    """
    if df_subset.empty:
        print(f"[WARN] No rows found for organ='{organ_name}'")
        return

    df_subset = df_subset.reset_index(drop=True).copy()

    total = len(df_subset)
    print(f"\n[INFO] Processing organ='{organ_name}' | total images: {total}")

    processed_rows = []
    all_embeddings = []

    num_batches = math.ceil(total / BATCH_SIZE)
    skipped = 0

    for batch_idx in range(num_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, total)
        batch_df = df_subset.iloc[start:end]

        batch_images = []
        batch_rows = []

        for _, row in batch_df.iterrows():
            image_path = row["image_path_final"]

            try:
                img = load_and_preprocess_image(image_path)
                batch_images.append(img)
                batch_rows.append(row)
            except Exception as e:
                print(f"[WARN] Skipping image: {image_path} | {e}")
                skipped += 1
                continue

        if not batch_images:
            continue

        batch_array = np.stack(batch_images, axis=0).astype(np.float32)

        # Forward pass
        embeddings = model(batch_array, training=False).numpy().astype(np.float32)

        # L2 normalize
        embeddings = l2_normalize(embeddings)

        all_embeddings.append(embeddings)

        for row in batch_rows:
            processed_rows.append({
                "sample_id": row["sample_id"],
                "source": row["source"],
                "source_type": row["source_type"],
                "split": row["split"],
                "original_label": row["original_label"],
                "label": row["label"],
                "organ": row["organ"],
                "image_path_raw": row["image_path_raw"],
                "image_path_final": row["image_path_final"],
                "is_crop_needed": row["is_crop_needed"],
                "bbox_index": row.get("bbox_index", ""),
                "class_id": row.get("class_id", ""),
                "bbox_x1": row.get("bbox_x1", ""),
                "bbox_y1": row.get("bbox_y1", ""),
                "bbox_x2": row.get("bbox_x2", ""),
                "bbox_y2": row.get("bbox_y2", ""),
                "crop_width": row.get("crop_width", ""),
                "crop_height": row.get("crop_height", ""),
            })

        print(f"[INFO] {organ_name}: batch {batch_idx + 1}/{num_batches} done")

    if not all_embeddings:
        print(f"[WARN] No embeddings extracted for organ='{organ_name}'")
        return

    embeddings_matrix = np.vstack(all_embeddings).astype(np.float32)

    metadata_df = pd.DataFrame(processed_rows)

    # Safety check: metadata rows must match embeddings rows
    if len(metadata_df) != embeddings_matrix.shape[0]:
        raise RuntimeError(
            f"Mismatch for organ='{organ_name}': "
            f"{len(metadata_df)} metadata rows vs {embeddings_matrix.shape[0]} embeddings"
        )

    np.save(output_npy, embeddings_matrix)
    metadata_df.to_csv(output_csv, index=False, encoding="utf-8")

    print(f"\n[DONE] organ='{organ_name}'")
    print(f"Saved embeddings: {output_npy}")
    print(f"Saved metadata:   {output_csv}")
    print(f"Embeddings shape: {embeddings_matrix.shape}")
    print(f"Skipped images:   {skipped}")

def main():
    ensure_dirs()

    df = pd.read_csv(FINAL_METADATA_CSV)

    # Basic sanity checks
    required_cols = [
        "sample_id",
        "source",
        "source_type",
        "split",
        "original_label",
        "label",
        "organ",
        "image_path_raw",
        "image_path_final",
        "is_crop_needed",
    ]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns in final_metadata.csv: {missing_cols}")

    fruit_df = df[df["organ"] == "fruit"].copy()
    leaf_df = df[df["organ"] == "leaf"].copy()

    process_subset(
        df_subset=fruit_df,
        organ_name="fruit",
        output_npy=FRUIT_EMBEDDINGS_NPY,
        output_csv=FRUIT_METADATA_CSV,
    )

    process_subset(
        df_subset=leaf_df,
        organ_name="leaf",
        output_npy=LEAF_EMBEDDINGS_NPY,
        output_csv=LEAF_METADATA_CSV,
    )

    print("\n===== ALL DONE =====")

if __name__ == "__main__":
    main()