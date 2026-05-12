import argparse
import os
from pathlib import Path

import numpy as np
from absl import logging as absl_logging

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import tensorflow as tf

try:
    from PIL import Image
except ImportError:
    Image = None

from config import IMAGE_SIZE, PROJECT_ROOT


EXPECTED_FEATURE_DIM = 1280
DEFAULT_TFLITE_MODEL = PROJECT_ROOT / "models" / "mobilenetv2_feature_extractor.tflite"
COSINE_WARNING_THRESHOLD = 0.999


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compare one Keras MobileNetV2 feature vector with one TFLite MobileNetV2 "
            "feature vector using the same explicit preprocessing."
        )
    )
    parser.add_argument("--image", required=True, help="Path to one local image file.")
    parser.add_argument(
        "--tflite-model",
        default=str(DEFAULT_TFLITE_MODEL),
        help=(
            "Path to the exported TFLite feature extractor. "
            f"Default: {DEFAULT_TFLITE_MODEL}"
        ),
    )
    return parser.parse_args()


def ensure_file_exists(path: Path, description: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {description}: {path}")


def load_and_preprocess_image(image_path: Path) -> np.ndarray:
    ensure_file_exists(image_path, "input image")

    if Image is not None:
        with Image.open(image_path) as image:
            image_rgb = image.convert("RGB")
            resized = image_rgb.resize(IMAGE_SIZE, resample=Image.Resampling.BILINEAR)
            array = np.asarray(resized, dtype=np.float32)
    else:
        image_bytes = tf.io.read_file(str(image_path))
        image_tensor = tf.io.decode_image(
            image_bytes,
            channels=3,
            expand_animations=False,
        )
        image_tensor = tf.image.resize(
            tf.cast(image_tensor, tf.float32),
            IMAGE_SIZE,
            method=tf.image.ResizeMethod.BILINEAR,
        )
        array = image_tensor.numpy().astype(np.float32)

    processed = tf.keras.applications.mobilenet_v2.preprocess_input(array)
    batch = np.expand_dims(processed, axis=0).astype(np.float32)
    return batch


def load_keras_model() -> tf.keras.Model:
    return tf.keras.applications.MobileNetV2(
        weights="imagenet",
        include_top=False,
        pooling="avg",
        input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3),
    )


def run_keras_feature_extractor(model: tf.keras.Model, batch: np.ndarray) -> np.ndarray:
    vector = model(batch, training=False).numpy().astype(np.float32).reshape(-1)
    return vector


def run_tflite_feature_extractor(tflite_model_path: Path, batch: np.ndarray) -> np.ndarray:
    ensure_file_exists(tflite_model_path, "TFLite model")

    interpreter = tf.lite.Interpreter(model_path=str(tflite_model_path))
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    interpreter.set_tensor(input_details[0]["index"], batch.astype(np.float32))
    interpreter.invoke()
    vector = interpreter.get_tensor(output_details[0]["index"]).astype(np.float32).reshape(-1)
    return vector


def l2_normalize(vector: np.ndarray, eps: float = 1e-10) -> tuple[np.ndarray, float]:
    norm = float(np.linalg.norm(vector))
    denominator = max(norm, eps)
    normalized = vector / denominator
    return normalized.astype(np.float32), norm


def ensure_expected_shape(vector: np.ndarray, description: str) -> None:
    if vector.shape != (EXPECTED_FEATURE_DIM,):
        raise ValueError(
            f"{description} shape must be ({EXPECTED_FEATURE_DIM},), got {vector.shape}"
        )


def cosine_similarity(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
    return float(np.dot(vector_a, vector_b))


def print_summary(
    image_path: Path,
    tflite_model_path: Path,
    keras_vector: np.ndarray,
    tflite_vector: np.ndarray,
    keras_norm_before: float,
    tflite_norm_before: float,
    keras_norm_after: float,
    tflite_norm_after: float,
    cosine_sim: float,
    max_abs_diff: float,
    mean_abs_diff: float,
) -> None:
    print("[KERAS VS TFLITE]")
    print(f"image_path: {image_path}")
    print(f"tflite_model_path: {tflite_model_path}")
    print(f"keras_vector_shape: {keras_vector.shape}")
    print(f"tflite_vector_shape: {tflite_vector.shape}")
    print(f"keras_norm_before_normalization: {keras_norm_before:.6f}")
    print(f"tflite_norm_before_normalization: {tflite_norm_before:.6f}")
    print(f"keras_norm_after_normalization: {keras_norm_after:.6f}")
    print(f"tflite_norm_after_normalization: {tflite_norm_after:.6f}")
    print(f"cosine_similarity: {cosine_sim:.6f}")
    print(f"max_absolute_difference: {max_abs_diff:.6f}")
    print(f"mean_absolute_difference: {mean_abs_diff:.6f}")
    print("keras_first_10_values: [" + ", ".join(f"{value:.6f}" for value in keras_vector[:10]) + "]")
    print("tflite_first_10_values: [" + ", ".join(f"{value:.6f}" for value in tflite_vector[:10]) + "]")

    if cosine_sim < COSINE_WARNING_THRESHOLD:
        print(
            "warning: cosine similarity is lower than expected; preprocessing or export may not match"
        )
    else:
        print("status: Keras and TFLite vectors appear closely compatible")

    print()
    print("example_command: python scripts/compare_keras_vs_tflite.py --image path/to/test_image.jpg")


def main() -> None:
    tf.get_logger().setLevel("ERROR")
    absl_logging.set_verbosity(absl_logging.ERROR)
    absl_logging.set_stderrthreshold("error")

    args = parse_args()
    image_path = Path(args.image).expanduser().resolve()
    tflite_model_path = Path(args.tflite_model).expanduser().resolve()

    batch = load_and_preprocess_image(image_path)
    keras_model = load_keras_model()
    keras_raw_vector = run_keras_feature_extractor(keras_model, batch)
    tflite_raw_vector = run_tflite_feature_extractor(tflite_model_path, batch)

    ensure_expected_shape(keras_raw_vector, "Keras feature vector")
    ensure_expected_shape(tflite_raw_vector, "TFLite feature vector")

    keras_normalized_vector, keras_norm_before = l2_normalize(keras_raw_vector)
    tflite_normalized_vector, tflite_norm_before = l2_normalize(tflite_raw_vector)

    keras_norm_after = float(np.linalg.norm(keras_normalized_vector))
    tflite_norm_after = float(np.linalg.norm(tflite_normalized_vector))
    cosine_sim = cosine_similarity(keras_normalized_vector, tflite_normalized_vector)

    absolute_difference = np.abs(keras_normalized_vector - tflite_normalized_vector)
    max_abs_diff = float(np.max(absolute_difference))
    mean_abs_diff = float(np.mean(absolute_difference))

    print_summary(
        image_path=image_path,
        tflite_model_path=tflite_model_path,
        keras_vector=keras_normalized_vector,
        tflite_vector=tflite_normalized_vector,
        keras_norm_before=keras_norm_before,
        tflite_norm_before=tflite_norm_before,
        keras_norm_after=keras_norm_after,
        tflite_norm_after=tflite_norm_after,
        cosine_sim=cosine_sim,
        max_abs_diff=max_abs_diff,
        mean_abs_diff=mean_abs_diff,
    )


if __name__ == "__main__":
    main()
