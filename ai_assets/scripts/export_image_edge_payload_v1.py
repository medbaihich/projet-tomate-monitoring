import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "raspberry-edge-payload.v1"
MESSAGE_TYPE = "feature_vector"
DEFAULT_DEVICE_IDENTIFIER = "tomato-edge-01"
DEFAULT_FEATURE_MODEL = "MobileNetV2_TensorFlow_Keras"
DEFAULT_EDGE_SOURCE = "local_pc"
DEFAULT_EDGE_RUNTIME = "tensorflow_keras"
DEFAULT_CAPTURE_MODE = "local_image_file"
EXPECTED_FEATURE_DIM = 1280


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract a MobileNetV2 feature vector from one local image on PC and "
            "save it as a canonical raspberry-edge-payload.v1 JSON file."
        )
    )
    parser.add_argument("--image", required=True, help="Path to one local image file.")
    parser.add_argument("--output", required=True, help="Path to the output JSON file.")
    parser.add_argument(
        "--device-identifier",
        "--device-id",
        dest="device_identifier",
        default=DEFAULT_DEVICE_IDENTIFIER,
        help=(
            "Device identifier in the payload and intended MQTT topic path. "
            f"Default: {DEFAULT_DEVICE_IDENTIFIER}"
        ),
    )
    parser.add_argument(
        "--image-id",
        default=None,
        help="Optional image id in the payload. Default: input image filename stem.",
    )
    parser.add_argument(
        "--source-message-id",
        default=None,
        help=(
            "Optional source_message_id override. Use this to preserve the exact "
            "same logical message for replay/idempotency tests."
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
        "--feature-model",
        default=DEFAULT_FEATURE_MODEL,
        help=(
            "Feature model name to store in the payload. Default: "
            f"{DEFAULT_FEATURE_MODEL}"
        ),
    )
    parser.add_argument(
        "--print-payload-summary",
        action="store_true",
        help="Print a short payload summary after saving the JSON file.",
    )
    return parser.parse_args()


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
    *,
    feature_result: dict,
    device_identifier: str,
    captured_at: str,
    image_id: str,
    source_message_id: str,
    feature_model: str,
) -> dict:
    if feature_result["feature_dim"] != EXPECTED_FEATURE_DIM:
        raise ValueError(
            f"feature_dim must remain {EXPECTED_FEATURE_DIM}, got {feature_result['feature_dim']}"
        )

    return {
        "schema_version": SCHEMA_VERSION,
        "message_type": MESSAGE_TYPE,
        "source_message_id": source_message_id,
        "device_identifier": device_identifier,
        "captured_at": captured_at,
        "image_id": image_id,
        "feature_model": feature_model,
        "feature_dim": feature_result["feature_dim"],
        "l2_normalized": True,
        "vector_norm": feature_result["vector_norm"],
        "feature_vector": feature_result["feature_vector"].tolist(),
        "edge_metadata": {
            "source": DEFAULT_EDGE_SOURCE,
            "runtime": DEFAULT_EDGE_RUNTIME,
            "capture_mode": DEFAULT_CAPTURE_MODE,
        },
    }


def extract_feature_result(image_path: Path) -> dict:
    from export_image_vector_payload import extract_feature_from_image

    return extract_feature_from_image(image_path)


def save_payload(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(payload, output_file, indent=2, ensure_ascii=False)
        output_file.write("\n")


def print_summary(
    *,
    image_path: Path,
    output_path: Path,
    payload: dict,
) -> None:
    print("[EDGE PAYLOAD EXPORT V1]")
    print(f"image_path: {image_path}")
    print(f"output_path: {output_path}")
    print(f"schema_version: {payload['schema_version']}")
    print(f"source_message_id: {payload['source_message_id']}")
    print(f"device_identifier: {payload['device_identifier']}")
    print(f"captured_at: {payload['captured_at']}")
    print(f"image_id: {payload['image_id']}")
    print(f"feature_model: {payload['feature_model']}")
    print(f"feature_dim: {payload['feature_dim']}")
    print(f"vector_norm: {payload['vector_norm']:.6f}")


def print_saved_message(output_path: Path) -> None:
    print("[EDGE PAYLOAD EXPORT V1]")
    print(f"saved_payload: {output_path}")


def main() -> None:
    args = parse_args()

    image_path = Path(args.image).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    device_identifier = args.device_identifier.strip()
    feature_model = args.feature_model.strip()
    if not device_identifier:
        raise ValueError("device_identifier cannot be empty")
    if not feature_model:
        raise ValueError("feature_model cannot be empty")

    image_id = (args.image_id or image_path.stem).strip()
    if not image_id:
        raise ValueError("image_id cannot be empty")

    captured_at = _normalize_captured_at(args.captured_at)
    source_message_id = (
        args.source_message_id.strip()
        if args.source_message_id is not None
        else _default_source_message_id(
            device_identifier=device_identifier,
            captured_at=captured_at,
            image_id=image_id,
        )
    )
    if not source_message_id:
        raise ValueError("source_message_id cannot be empty")

    feature_result = extract_feature_result(image_path)
    payload = build_payload(
        feature_result=feature_result,
        device_identifier=device_identifier,
        captured_at=captured_at,
        image_id=image_id,
        source_message_id=source_message_id,
        feature_model=feature_model,
    )
    save_payload(payload, output_path)
    if args.print_payload_summary:
        print_summary(
            image_path=image_path,
            output_path=output_path,
            payload=payload,
        )
    else:
        print_saved_message(output_path)


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ImportError, ValueError) as exc:
        print("[ERROR]")
        print(str(exc))
        raise SystemExit(1) from exc
