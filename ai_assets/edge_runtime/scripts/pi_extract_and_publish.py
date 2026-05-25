import argparse
import json
from datetime import datetime, timezone
import os
from pathlib import Path
from threading import Event
import re
from argparse import SUPPRESS

import numpy as np

from extract_features_from_image import (
    ensure_file_exists,
    l2_normalize,
    load_and_preprocess_image,
    validate_feature_vector,
)
from evidence_image_utils import (
    build_capture_artifact,
    resolve_image_store_dir,
)

try:
    import paho.mqtt.client as mqtt
except ImportError as exc:
    raise SystemExit(
        "Missing dependency 'paho-mqtt'. Install it with: pip install paho-mqtt"
    ) from exc


DEFAULT_PORT = 1883
DEFAULT_USERNAME = "tomato_mqtt"
DEFAULT_PASSWORD = "tomato_mqtt_pass"
DEFAULT_DEVICE_IDENTIFIER = "tomato-edge-01"
DEFAULT_FEATURE_MODEL = "MobileNetV2_TFLite"
DEFAULT_EXPECTED_DIM = 1280
DEFAULT_QOS = 1
DEFAULT_KEEPALIVE = 60
CONNECT_TIMEOUT_SECONDS = 10
PUBLISH_TIMEOUT_SECONDS = 10
SCHEMA_VERSION = "raspberry-edge-payload.v1"
MESSAGE_TYPE = "feature_vector"
DEFAULT_CAPTURE_MODE = "single_image"
DEFAULT_RUNTIME_SOURCE = "raspberry_pi"


def default_topic_for_device(device_identifier: str) -> str:
    return f"tomato/edge/v1/{device_identifier}/feature-vector"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract a MobileNetV2 TFLite feature vector from one local image and "
            "publish it as JSON over MQTT."
        )
    )
    parser.add_argument("--image", required=True, help="Path to one local image file.")
    parser.add_argument("--model", required=True, help="Path to one TFLite model file.")
    parser.add_argument("--host", required=True, help="MQTT broker host.")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"MQTT broker port. Default: {DEFAULT_PORT}",
    )
    parser.add_argument(
        "--username",
        default=DEFAULT_USERNAME,
        help=f"MQTT username. Default: {DEFAULT_USERNAME}",
    )
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help=f"MQTT password. Default: {DEFAULT_PASSWORD}",
    )
    parser.add_argument(
        "--topic",
        default=None,
        help=(
            "MQTT topic to publish to. Default: "
            "tomato/edge/v1/{device_identifier}/feature-vector"
        ),
    )
    parser.add_argument(
        "--device-identifier",
        "--device-id",
        dest="device_identifier",
        default=DEFAULT_DEVICE_IDENTIFIER,
        help=(
            "Device identifier in the JSON payload and default MQTT topic. "
            f"Default: {DEFAULT_DEVICE_IDENTIFIER}"
        ),
    )
    parser.add_argument(
        "--image-id",
        default=None,
        help="Optional image id in the JSON payload. Default: image filename stem.",
    )
    parser.add_argument(
        "--source-message-id",
        default=None,
        help=(
            "Optional source_message_id override. Use this to preserve the exact "
            "same logical message across retries or duplicate/idempotency tests."
        ),
    )
    parser.add_argument(
        "--captured-at",
        default=None,
        help=(
            "Optional captured_at ISO-8601 timestamp override. Default: current UTC "
            "time with milliseconds."
        ),
    )
    parser.add_argument(
        "--crop-id",
        dest="legacy_crop_id",
        default=None,
        help=SUPPRESS,
    )
    parser.add_argument(
        "--feature-model",
        default=DEFAULT_FEATURE_MODEL,
        help=f"Feature model name in the JSON payload. Default: {DEFAULT_FEATURE_MODEL}",
    )
    parser.add_argument(
        "--expected-dim",
        type=int,
        default=DEFAULT_EXPECTED_DIM,
        help=f"Expected feature vector dimension. Default: {DEFAULT_EXPECTED_DIM}",
    )
    parser.add_argument(
        "--qos",
        type=int,
        default=DEFAULT_QOS,
        help=f"MQTT QoS level. Default: {DEFAULT_QOS}",
    )
    parser.add_argument(
        "--keepalive",
        type=int,
        default=DEFAULT_KEEPALIVE,
        help=f"MQTT keepalive seconds. Default: {DEFAULT_KEEPALIVE}",
    )
    parser.add_argument(
        "--client-id",
        default=None,
        help=(
            "Optional MQTT client id. Default: raspberry-{device_identifier}."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and validate the payload without connecting to MQTT.",
    )
    parser.add_argument(
        "--print-payload-summary",
        action="store_true",
        help="Print payload byte size and a short feature vector summary.",
    )
    parser.add_argument(
        "--save-payload",
        default=None,
        help=(
            "Optional path to save the generated JSON payload before publish. "
            "Useful for inspection and duplicate replay tests."
        ),
    )
    parser.add_argument(
        "--image-store-dir",
        default=os.getenv("EDGE_IMAGE_STORE_DIR"),
        help=(
            "Directory where the source image will be copied into the local edge "
            "evidence store. Default: EDGE_IMAGE_STORE_DIR or ~/tomato-edge/evidence-images."
        ),
    )
    parser.add_argument(
        "--retention-hours",
        type=int,
        default=int(os.getenv("EDGE_IMAGE_RETENTION_HOURS", "0") or 0) or None,
        help=(
            "Optional retention window for the stored evidence image. When set, "
            "capture_artifact.retention_until is computed from captured_at."
        ),
    )
    return parser.parse_args()


def create_mqtt_client(client_id: str) -> mqtt.Client:
    callback_api_version = getattr(mqtt, "CallbackAPIVersion", None)
    if callback_api_version is not None and hasattr(callback_api_version, "VERSION2"):
        return mqtt.Client(
            callback_api_version=callback_api_version.VERSION2,
            client_id=client_id,
            protocol=mqtt.MQTTv311,
        )

    return mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)


def reason_code_is_success(reason_code) -> bool:
    try:
        return int(reason_code) == 0
    except (TypeError, ValueError):
        return str(reason_code).lower() == "success"


def load_interpreter(model_path: Path):
    try:
        from tflite_runtime.interpreter import Interpreter
        runtime_name = "tflite-runtime"
    except ImportError:
        try:
            from ai_edge_litert.interpreter import Interpreter
            runtime_name = "ai-edge-litert"
        except ImportError:
            try:
                from tensorflow.lite import Interpreter
                runtime_name = "tensorflow.lite"
            except ImportError:
                try:
                    import tensorflow as tf

                    Interpreter = tf.lite.Interpreter
                    runtime_name = "tensorflow.lite"
                except ImportError as exc:
                    raise ImportError(
                        "Could not import a TFLite-compatible interpreter. Install one "
                        "of: ai-edge-litert, tflite-runtime, or tensorflow."
                    ) from exc

    return Interpreter(model_path=str(model_path)), runtime_name


def extract_normalized_vector(
    image_path: Path,
    model_path: Path,
    expected_dim: int,
) -> dict:
    ensure_file_exists(image_path, "input image")
    ensure_file_exists(model_path, "TFLite model")

    input_batch, original_size = load_and_preprocess_image(image_path)
    interpreter, runtime_name = load_interpreter(model_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    if not input_details:
        raise RuntimeError("Interpreter returned no input tensor details")
    if not output_details:
        raise RuntimeError("Interpreter returned no output tensor details")

    input_index = input_details[0]["index"]
    input_dtype = np.dtype(input_details[0]["dtype"])
    model_input = input_batch.astype(input_dtype, copy=False)
    interpreter.set_tensor(input_index, model_input)
    interpreter.invoke()

    output_index = output_details[0]["index"]
    raw_output = interpreter.get_tensor(output_index)
    feature_vector = np.asarray(raw_output, dtype=np.float32).reshape(-1)
    normalized_vector, norm_before = l2_normalize(feature_vector)
    is_valid, errors, norm_after, non_zero_count = validate_feature_vector(
        normalized_vector,
        expected_dim=expected_dim,
    )
    if not is_valid:
        raise ValueError("; ".join(errors))

    return {
        "runtime_name": runtime_name,
        "image_path": image_path,
        "model_path": model_path,
        "original_size": original_size,
        "input_shape": tuple(input_batch.shape),
        "output_shape": tuple(raw_output.shape),
        "feature_vector": normalized_vector,
        "feature_shape": tuple(normalized_vector.shape),
        "feature_dtype": str(normalized_vector.dtype),
        "norm_before": norm_before,
        "norm_after": norm_after,
        "non_zero_count": int(non_zero_count),
    }


def _current_utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )


def _normalize_captured_at(value: str | None) -> str:
    if value is None:
        return _current_utc_timestamp()

    candidate = value.strip()
    if not candidate:
        raise ValueError("captured_at cannot be empty when provided")

    normalized = candidate.replace(":", "").replace("-", "")
    if normalized.endswith("Z"):
        return candidate

    if re.search(r"[+-]\d{2}:\d{2}$", candidate):
        return candidate

    raise ValueError(
        "captured_at must be an ISO-8601 timestamp with timezone information"
    )


def _compact_timestamp_for_message_id(captured_at: str) -> str:
    return (
        captured_at.replace("-", "")
        .replace(":", "")
        .replace(".", "")
        .replace("+00:00", "Z")
    )


def _default_source_message_id(
    *,
    device_identifier: str,
    captured_at: str,
    image_id: str,
) -> str:
    compact_timestamp = _compact_timestamp_for_message_id(captured_at)
    sanitized_image_id = re.sub(r"[^A-Za-z0-9._-]+", "-", image_id).strip("-") or "image"
    return f"{device_identifier}-{compact_timestamp}-{sanitized_image_id}"


def build_payload(
    args: argparse.Namespace,
    vector: np.ndarray,
    *,
    image_id: str,
    captured_at: str,
    source_message_id: str,
    runtime_name: str,
    capture_artifact: dict,
) -> dict:
    vector_norm = float(np.linalg.norm(vector))
    edge_metadata = {
        "source": DEFAULT_RUNTIME_SOURCE,
        "runtime": runtime_name,
        "capture_mode": DEFAULT_CAPTURE_MODE,
    }
    if args.legacy_crop_id:
        edge_metadata["legacy_crop_id"] = args.legacy_crop_id

    return {
        "schema_version": SCHEMA_VERSION,
        "message_type": MESSAGE_TYPE,
        "source_message_id": source_message_id,
        "device_identifier": args.device_identifier,
        "captured_at": captured_at,
        "image_id": image_id,
        "feature_model": args.feature_model,
        "feature_dim": args.expected_dim,
        "l2_normalized": True,
        "vector_norm": vector_norm,
        "feature_vector": vector.astype(np.float32).tolist(),
        "capture_artifact": capture_artifact,
        "edge_metadata": edge_metadata,
    }


def payload_to_bytes(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def print_feature_summary(result: dict) -> None:
    feature_vector = result["feature_vector"]
    print("[EDGE FEATURE EXTRACTION]")
    print(f"runtime : {result['runtime_name']}")
    print(f"image_path: {result['image_path']}")
    print(f"model_path: {result['model_path']}")
    print(f"feature_shape: {result['feature_shape']}")
    print(f"dtype: {result['feature_dtype']}")
    print(f"norm_before_normalization: {result['norm_before']:.6f}")
    print(f"norm_after_normalization: {result['norm_after']:.6f}")
    print(
        "first_10_values: ["
        + ", ".join(f"{float(value):.6f}" for value in feature_vector[:10])
        + "]"
    )


def print_payload_summary(
    payload: dict,
    topic: str,
    payload_bytes: bytes,
    print_extra: bool,
) -> None:
    print("[PAYLOAD]")
    print(f"schema_version: {payload['schema_version']}")
    print(f"source_message_id: {payload['source_message_id']}")
    print(f"device_identifier: {payload['device_identifier']}")
    print(f"captured_at: {payload['captured_at']}")
    print(f"image_id: {payload['image_id']}")
    print(f"message_type: {payload['message_type']}")
    print(f"feature_model: {payload['feature_model']}")
    print(f"feature_dim: {payload['feature_dim']}")
    print(f"vector_norm: {payload['vector_norm']:.6f}")
    capture_artifact = payload.get("capture_artifact") or {}
    print(f"local_image_ref: {capture_artifact.get('local_image_ref', '')}")
    print(f"stored_image_sha256: {capture_artifact.get('image_sha256', '')}")
    print(f"topic: {topic}")
    if print_extra:
        print(f"payload_byte_size_estimate: {len(payload_bytes)}")


def publish_payload(args: argparse.Namespace, payload_bytes: bytes) -> None:
    connected_event = Event()
    published_event = Event()
    runtime_state = {"connect_error": None}
    client_identifier = args.client_id or f"raspberry-{args.device_identifier}"
    client = create_mqtt_client(client_identifier)
    client.username_pw_set(args.username, args.password)

    def on_connect(client, userdata, flags, reason_code, properties=None) -> None:
        if reason_code_is_success(reason_code):
            connected_event.set()
            return
        runtime_state["connect_error"] = (
            f"MQTT connection failed with reason code: {reason_code}"
        )
        connected_event.set()

    def on_publish(client, userdata, mid, reason_code=None, properties=None) -> None:
        published_event.set()

    client.on_connect = on_connect
    client.on_publish = on_publish

    try:
        client.connect(args.host, args.port, keepalive=args.keepalive)
        client.loop_start()

        if not connected_event.wait(CONNECT_TIMEOUT_SECONDS):
            raise TimeoutError(
                f"Timed out waiting for MQTT connection to {args.host}:{args.port}"
            )
        if runtime_state["connect_error"] is not None:
            raise ConnectionError(runtime_state["connect_error"])

        publish_result = client.publish(args.topic, payload=payload_bytes, qos=args.qos)
        if publish_result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(
                f"MQTT publish failed immediately with return code: {publish_result.rc}"
            )
        if not published_event.wait(PUBLISH_TIMEOUT_SECONDS):
            raise TimeoutError("Timed out waiting for MQTT publish acknowledgement")
    except OSError as exc:
        raise ConnectionError(
            f"MQTT connection failed for {args.host}:{args.port}: {exc}"
        ) from exc
    finally:
        try:
            client.disconnect()
        finally:
            client.loop_stop()


def main() -> None:
    args = parse_args()
    image_path = Path(args.image).expanduser().resolve()
    model_path = Path(args.model).expanduser().resolve()
    image_id = args.image_id or image_path.stem
    captured_at = _normalize_captured_at(args.captured_at)
    source_message_id = (
        args.source_message_id
        or _default_source_message_id(
            device_identifier=args.device_identifier,
            captured_at=captured_at,
            image_id=image_id,
        )
    )
    topic = args.topic or default_topic_for_device(args.device_identifier)
    image_store_dir = resolve_image_store_dir(args.image_store_dir)

    result = extract_normalized_vector(
        image_path=image_path,
        model_path=model_path,
        expected_dim=args.expected_dim,
    )
    capture_artifact, stored_image_path = build_capture_artifact(
        source_path=image_path,
        image_store_dir=image_store_dir,
        source_message_id=source_message_id,
        image_id=image_id,
        captured_at=captured_at,
        retention_hours=args.retention_hours,
    )
    payload = build_payload(
        args,
        result["feature_vector"],
        image_id=image_id,
        captured_at=captured_at,
        source_message_id=source_message_id,
        runtime_name=result["runtime_name"],
        capture_artifact=capture_artifact,
    )
    payload_bytes = payload_to_bytes(payload)

    if args.save_payload:
        save_path = Path(args.save_payload).expanduser().resolve()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_bytes(payload_bytes)

    print_feature_summary(result)
    print_payload_summary(
        payload,
        topic=topic,
        payload_bytes=payload_bytes,
        print_extra=args.dry_run or args.print_payload_summary,
    )

    print("[MQTT]")
    print(f"broker: {args.host}:{args.port}")
    print(f"client_id: {args.client_id or f'raspberry-{args.device_identifier}'}")
    print(f"topic: {topic}")
    print(f"qos: {args.qos}")
    print(f"image_store_dir: {image_store_dir}")
    print(f"stored_image_path: {stored_image_path}")
    if args.save_payload:
        print(f"saved_payload: {Path(args.save_payload).expanduser().resolve()}")

    if args.dry_run:
        print("status: dry-run")
        return

    args.topic = topic
    publish_payload(args, payload_bytes)
    print("status: publish success")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ImportError, RuntimeError, ValueError, ConnectionError, TimeoutError) as exc:
        print("[ERROR]")
        print(str(exc))
        raise SystemExit(1) from exc
