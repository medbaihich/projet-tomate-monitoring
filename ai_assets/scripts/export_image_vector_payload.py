import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from absl import logging as absl_logging

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import tensorflow as tf

from config import IMAGE_SIZE


DEFAULT_DEVICE_ID = "test-device-001"
DEFAULT_CROP_ID = "crop_001"
EXPECTED_FEATURE_DIM = 1280


preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input
tf.get_logger().setLevel("ERROR")
absl_logging.set_verbosity(absl_logging.ERROR)
absl_logging.set_stderrthreshold("error")

_MOBILENET_MODEL = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract a MobileNetV2 feature vector from one local image and save it as "
            "a JSON payload for local edge-output simulation."
        )
    )
    parser.add_argument("--image", required=True, help="Path to one local image file.")
    parser.add_argument("--output", required=True, help="Path to the output JSON file.")
    parser.add_argument(
        "--device-id",
        default=DEFAULT_DEVICE_ID,
        help=f"Device identifier to store in the payload. Default: {DEFAULT_DEVICE_ID}",
    )
    parser.add_argument(
        "--image-id",
        help="Optional image identifier. Default: input image filename stem.",
    )
    parser.add_argument(
        "--crop-id",
        default=DEFAULT_CROP_ID,
        help=f"Crop identifier to store in the payload. Default: {DEFAULT_CROP_ID}",
    )
    return parser.parse_args()


def ensure_file_exists(path: Path, description: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")


def load_mobilenet_model():
    global _MOBILENET_MODEL

    if _MOBILENET_MODEL is None:
        _MOBILENET_MODEL = tf.keras.applications.MobileNetV2(
            weights="imagenet",
            include_top=False,
            pooling="avg",
            input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3),
        )

    return _MOBILENET_MODEL


def l2_normalize(vectors: np.ndarray, eps: float = 1e-10) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return vectors / norms


def extract_feature_from_image(image_path: Path) -> dict:
    ensure_file_exists(image_path, "input image")

    image_bgr = cv2.imread(str(image_path))
    if image_bgr is None:
        raise ValueError(f"Could not read image with OpenCV: {image_path}")

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(image_rgb, IMAGE_SIZE, interpolation=cv2.INTER_AREA)
    processed = resized.astype(np.float32)
    processed = preprocess_input(processed)
    batch = np.expand_dims(processed, axis=0).astype(np.float32)

    model = load_mobilenet_model()
    vector = model(batch, training=False).numpy().astype(np.float32)
    vector = l2_normalize(vector).astype(np.float32)

    feature_vector = vector[0]
    feature_dim = int(feature_vector.shape[0])
    if feature_dim != EXPECTED_FEATURE_DIM:
        raise ValueError(
            f"Unexpected feature dimension: expected {EXPECTED_FEATURE_DIM}, got {feature_dim}"
        )

    vector_norm = float(np.linalg.norm(feature_vector))
    return {
        "feature_vector": feature_vector,
        "feature_dim": feature_dim,
        "vector_norm": vector_norm,
    }


def build_payload(
    image_path: Path,
    feature_result: dict,
    device_id: str,
    image_id: str | None,
    crop_id: str,
) -> dict:
    resolved_image_id = image_id if image_id else image_path.stem

    return {
        "device_id": device_id,
        "message_type": "feature_vector",
        "image_id": resolved_image_id,
        "crop_id": crop_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "feature_model": "MobileNetV2",
        "feature_dim": feature_result["feature_dim"],
        "l2_normalized": True,
        "vector_norm": feature_result["vector_norm"],
        "feature_vector": feature_result["feature_vector"].tolist(),
    }


def save_payload(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(payload, output_file, indent=2)


def print_summary(image_path: Path, output_path: Path, feature_result: dict) -> None:
    print("[EXPORT IMAGE VECTOR PAYLOAD]")
    print(f"image_path: {image_path}")
    print(f"output_path: {output_path}")
    print(f"feature_dim: {feature_result['feature_dim']}")
    print(f"vector_norm: {feature_result['vector_norm']:.6f}")


def main() -> None:
    args = parse_args()

    image_path = Path(args.image).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    feature_result = extract_feature_from_image(image_path)
    payload = build_payload(
        image_path=image_path,
        feature_result=feature_result,
        device_id=args.device_id,
        image_id=args.image_id,
        crop_id=args.crop_id,
    )
    save_payload(payload, output_path)
    print_summary(image_path, output_path, feature_result)


if __name__ == "__main__":
    main()
