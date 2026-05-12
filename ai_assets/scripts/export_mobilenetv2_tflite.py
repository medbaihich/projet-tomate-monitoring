import os
import contextlib
from pathlib import Path

from absl import logging as absl_logging

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import tensorflow as tf
from tensorflow.python.util import keras_deps

from config import IMAGE_SIZE, PROJECT_ROOT


OUTPUT_PATH = PROJECT_ROOT / "models" / "mobilenetv2_feature_extractor.tflite"


class _LiteCallContextShim:
    def enter(self, *args, **kwargs):
        return contextlib.nullcontext()


def load_feature_extractor() -> tf.keras.Model:
    return tf.keras.applications.MobileNetV2(
        weights="imagenet",
        include_top=False,
        pooling="avg",
        input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3),
    )


def export_tflite_model(model: tf.keras.Model, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # TensorFlow Lite in this environment expects a registered Keras call-context
    # hook. Keras 3 may leave it unset, so we provide a no-op shim for export.
    keras_deps.register_call_context_function(lambda: _LiteCallContextShim())

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    output_path.write_bytes(tflite_model)


def print_summary(model: tf.keras.Model, output_path: Path) -> None:
    file_size_mb = output_path.stat().st_size / (1024 * 1024)

    print("[EXPORT MOBILENETV2 TFLITE]")
    print(f"model_input_shape: {model.input_shape}")
    print(f"model_output_shape: {model.output_shape}")
    print(f"output_path: {output_path}")
    print(f"file_size_mb: {file_size_mb:.2f}")
    print("success: exported float32 MobileNetV2 feature extractor to TFLite")


def main() -> None:
    tf.get_logger().setLevel("ERROR")
    absl_logging.set_verbosity(absl_logging.ERROR)
    absl_logging.set_stderrthreshold("error")

    model = load_feature_extractor()
    export_tflite_model(model, OUTPUT_PATH)
    print_summary(model, OUTPUT_PATH)


if __name__ == "__main__":
    main()
