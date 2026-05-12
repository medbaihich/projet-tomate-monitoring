import argparse
import json
import sys
from threading import Event
from pathlib import Path

try:
    import numpy as np
except ImportError as exc:
    raise SystemExit("Missing dependency 'numpy'. Install it with: pip install numpy") from exc

try:
    import paho.mqtt.client as mqtt
except ImportError as exc:
    raise SystemExit(
        "Missing dependency 'paho-mqtt'. Install it with: pip install paho-mqtt"
    ) from exc

PROJECT_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT_DIR))

from ai_engine.vector_inference_service import InferenceConfig, run_inference_from_payload


DEFAULT_HOST = "localhost"
DEFAULT_PORT = 1883
DEFAULT_USERNAME = "edge"
DEFAULT_PASSWORD = "edgepass123"
DEFAULT_TOPIC = "tomato/edge/features"
DEFAULT_CLIENT_ID = "pc-ai-vector-receiver"
EXPECTED_FEATURE_DIM = 1280
MIN_ACCEPTED_NORM = 0.98
MAX_ACCEPTED_NORM = 1.02
MQTT_KEEPALIVE_SECONDS = 60
CONNECT_TIMEOUT_SECONDS = 10
DEFAULT_TOP_K_DISEASE = 5
DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA = 0.70


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Receive one MQTT vector payload and validate it for the Phase A PC-to-PC test."
        )
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"MQTT broker host. Default: {DEFAULT_HOST}",
    )
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
        default=DEFAULT_TOPIC,
        help=f"MQTT topic to subscribe to. Default: {DEFAULT_TOPIC}",
    )
    parser.add_argument(
        "--client-id",
        default=DEFAULT_CLIENT_ID,
        help=f"MQTT client id. Default: {DEFAULT_CLIENT_ID}",
    )
    parser.add_argument(
        "--run-inference",
        action="store_true",
        help="After payload validation passes, run the PC-side vector AI/FAISS pipeline.",
    )
    parser.add_argument(
        "--top-k-disease",
        type=int,
        default=DEFAULT_TOP_K_DISEASE,
        help=f"Number of disease neighbors to retrieve when --run-inference is used. Default: {DEFAULT_TOP_K_DISEASE}",
    )
    parser.add_argument(
        "--min-organ-classifier-proba",
        type=float,
        default=DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA,
        help=(
            "Minimum organ classifier probability required to trust classifier routing when "
            f"--run-inference is used. Default: {DEFAULT_MIN_ORGAN_CLASSIFIER_PROBA:.2f}"
        ),
    )
    parser.add_argument(
        "--output-json",
        help="Optional path to save or append JSON results for each handled message.",
    )
    parser.add_argument(
        "--pretty-json",
        action="store_true",
        help="Print the final handled-message result as formatted JSON.",
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


def format_float(value) -> str:
    if value is None:
        return "<not available>"
    return f"{float(value):.6f}"


def format_vector_preview(values: list[float] | None) -> str:
    if values is None:
        return "<not available>"

    return "[" + ", ".join(f"{float(value):.6f}" for value in values) + "]"


def to_jsonable(value):
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def write_json_result(output_path_value: str, result_payload: dict) -> None:
    output_path = Path(output_path_value).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    jsonable_result = to_jsonable(result_payload)

    if output_path.exists():
        try:
            existing_payload = json.loads(output_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing_payload = []

        if isinstance(existing_payload, list):
            existing_payload.append(jsonable_result)
            output_path.write_text(
                json.dumps(existing_payload, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            return

        output_path.write_text(
            json.dumps([existing_payload, jsonable_result], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return

    output_path.write_text(
        json.dumps([jsonable_result], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def validate_payload(payload: dict) -> dict:
    errors: list[str] = []
    declared_vector_norm = payload.get("vector_norm")
    computed_vector_norm = None
    vector_norm_difference = None
    first_10_values = None
    vector_min = None
    vector_max = None
    non_zero_count = None

    if payload.get("message_type") != "feature_vector":
        errors.append("message_type must be feature_vector")

    if payload.get("feature_dim") != EXPECTED_FEATURE_DIM:
        errors.append(f"feature_dim must equal {EXPECTED_FEATURE_DIM}")

    feature_vector = payload.get("feature_vector")
    if not isinstance(feature_vector, list):
        errors.append("feature_vector must exist and be a list")
        return {
            "errors": errors,
            "declared_vector_norm": declared_vector_norm,
            "computed_vector_norm": computed_vector_norm,
            "vector_norm_difference": vector_norm_difference,
            "first_10_values": first_10_values,
            "vector_min": vector_min,
            "vector_max": vector_max,
            "non_zero_count": non_zero_count,
        }

    if len(feature_vector) != EXPECTED_FEATURE_DIM:
        errors.append(f"len(feature_vector) must equal {EXPECTED_FEATURE_DIM}")

    try:
        vector = np.asarray(feature_vector, dtype=np.float32)
    except (TypeError, ValueError):
        errors.append("feature_vector must be convertible to numpy.float32")
        return {
            "errors": errors,
            "declared_vector_norm": declared_vector_norm,
            "computed_vector_norm": computed_vector_norm,
            "vector_norm_difference": vector_norm_difference,
            "first_10_values": first_10_values,
            "vector_min": vector_min,
            "vector_max": vector_max,
            "non_zero_count": non_zero_count,
        }

    if vector.ndim != 1:
        errors.append(f"feature_vector must be 1D, got shape {vector.shape}")
    else:
        first_10_values = vector[:10].astype(float).tolist()
        if vector.size > 0:
            vector_min = float(vector.min())
            vector_max = float(vector.max())
            non_zero_count = int(np.count_nonzero(vector))
            computed_vector_norm = float(np.linalg.norm(vector))

    if not np.isfinite(vector).all():
        errors.append("feature_vector contains NaN or Inf")

    if computed_vector_norm is not None:
        if not MIN_ACCEPTED_NORM <= computed_vector_norm <= MAX_ACCEPTED_NORM:
            errors.append(
                "computed L2 norm must be between "
                f"{MIN_ACCEPTED_NORM:.2f} and {MAX_ACCEPTED_NORM:.2f}, "
                f"got {computed_vector_norm:.6f}"
            )

    if declared_vector_norm is not None and computed_vector_norm is not None:
        try:
            vector_norm_difference = abs(float(declared_vector_norm) - computed_vector_norm)
        except (TypeError, ValueError):
            vector_norm_difference = None

    return {
        "errors": errors,
        "declared_vector_norm": declared_vector_norm,
        "computed_vector_norm": computed_vector_norm,
        "vector_norm_difference": vector_norm_difference,
        "first_10_values": first_10_values,
        "vector_min": vector_min,
        "vector_max": vector_max,
        "non_zero_count": non_zero_count,
    }


def print_receiver_header(args: argparse.Namespace) -> None:
    print("[MQTT RECEIVER]")
    print(f"broker: {args.host}:{args.port}")
    print(f"topic: {args.topic}")
    print(f"client_id: {args.client_id}")
    print(f"run_inference: {str(args.run_inference).lower()}")
    print("status: listening for messages")


def print_payload_validation_report(topic: str, payload: dict, validation_result: dict) -> None:
    print()
    print("[PAYLOAD VALIDATION]")
    print(f"topic: {topic}")
    print(f"device_id: {payload.get('device_id', '<missing>')}")
    print(f"image_id: {payload.get('image_id', '<missing>')}")
    print(f"crop_id: {payload.get('crop_id', '<missing>')}")
    print(f"message_type: {payload.get('message_type', '<missing>')}")
    print(f"feature_dim: {payload.get('feature_dim', '<missing>')}")
    print(f"declared_vector_norm: {payload.get('vector_norm', '<missing>')}")
    print(f"computed_norm: {format_float(validation_result['computed_vector_norm'])}")
    print(
        "vector_norm_difference: "
        f"{format_float(validation_result['vector_norm_difference'])}"
    )
    print(
        "first_10_values: "
        f"{format_vector_preview(validation_result['first_10_values'])}"
    )
    print(f"vector_min: {format_float(validation_result['vector_min'])}")
    print(f"vector_max: {format_float(validation_result['vector_max'])}")
    if validation_result["non_zero_count"] is None:
        print("non_zero_count: <not available>")
    else:
        print(f"non_zero_count: {validation_result['non_zero_count']}")

    if validation_result["errors"]:
        print("status: FAILED")
        for error in validation_result["errors"]:
            print(f"- {error}")
        return

    print("status: OK")


def build_validation_summary(topic: str, payload: dict, validation_result: dict) -> dict:
    return {
        "topic": topic,
        "device_id": payload.get("device_id", ""),
        "image_id": payload.get("image_id", ""),
        "crop_id": payload.get("crop_id", ""),
        "message_type": payload.get("message_type", ""),
        "feature_dim": payload.get("feature_dim"),
        "declared_vector_norm": payload.get("vector_norm"),
        "computed_norm": validation_result["computed_vector_norm"],
        "vector_norm_difference": validation_result["vector_norm_difference"],
        "first_10_values": validation_result["first_10_values"],
        "vector_min": validation_result["vector_min"],
        "vector_max": validation_result["vector_max"],
        "non_zero_count": validation_result["non_zero_count"],
        "status": "FAILED" if validation_result["errors"] else "OK",
        "errors": list(validation_result["errors"]),
    }


def build_public_inference_result(inference_result: dict) -> dict:
    return {
        "device_id": inference_result.get("device_id", ""),
        "image_id": inference_result.get("image_id", ""),
        "crop_id": inference_result.get("crop_id", ""),
        "feature_model": inference_result.get("feature_model", ""),
        "message_type": inference_result.get("message_type", ""),
        "feature_dim": inference_result.get("feature_dim"),
        "vector_norm": inference_result.get("vector_norm"),
        "input_vector_norm": inference_result.get("input_vector_norm"),
        "declared_vector_norm": inference_result.get("declared_vector_norm"),
        "organ_type": inference_result.get("organ_type", ""),
        "organ_confidence": inference_result.get("organ_confidence"),
        "organ_status": inference_result.get("organ_status", ""),
        "index_used": inference_result.get("index_used", ""),
        "metadata_used": inference_result.get("metadata_used", ""),
        "score_type": inference_result.get("score_type", ""),
        "top1_label": inference_result.get("top1_label", ""),
        "top1_score": inference_result.get("top1_score"),
        "majority_label": inference_result.get("majority_label", ""),
        "final_label": inference_result.get("final_label", ""),
        "matches": inference_result.get("matches", []),
        "processing_status": inference_result.get("processing_status", ""),
        "requires_review": inference_result.get("requires_review", False),
        "warnings": inference_result.get("warnings", []),
        "skip_reasons": inference_result.get("skip_reasons", []),
    }


def print_organ_router_report(inference_result: dict) -> None:
    print()
    print("[ORGAN ROUTER]")
    print(f"organ_type: {inference_result.get('organ_type', '<unknown>')}")
    print(f"confidence: {format_float(inference_result.get('organ_confidence'))}")
    print(f"status: {inference_result.get('organ_status', '<unknown>')}")


def print_faiss_report(inference_result: dict) -> None:
    print()
    print("[FAISS SEARCH]")

    if inference_result.get("processing_status") == "skipped_unknown_organ":
        print("status: skipped")
        for reason in inference_result.get("skip_reasons", []):
            print(f"reason: {reason}")
        return

    print(f"index_used: {inference_result.get('index_used', '')}")
    print(f"top1_label: {inference_result.get('top1_label', '')}")
    top1_score = inference_result.get("top1_score")
    print(f"top1_score: {format_float(top1_score)}")
    print(f"majority_label: {inference_result.get('majority_label', '')}")
    print(f"final_label: {inference_result.get('final_label', '')}")
    print("score_note: FAISS score is similarity, not calibrated probability")
    print("matches_top_k:")
    matches = inference_result.get("matches", [])
    if not matches:
        print("- <no matches>")
        return

    for match in matches:
        print(
            f"- rank={match.get('rank')} "
            f"label={match.get('label', '')} "
            f"score={format_float(match.get('score'))}"
        )


def print_result_report(inference_result: dict) -> None:
    print()
    print("[RESULT]")
    print(f"processing_status: {inference_result.get('processing_status', '')}")
    print(f"requires_review: {str(bool(inference_result.get('requires_review', False))).lower()}")
    warnings = inference_result.get("warnings", [])
    if warnings:
        print("warnings:")
        for warning in warnings:
            print(f"- {warning}")
    else:
        print("warnings: none")


def print_pretty_json(result_payload: dict) -> None:
    print()
    print(json.dumps(to_jsonable(result_payload), indent=2, ensure_ascii=False))


def main() -> None:
    args = parse_args()
    if args.top_k_disease <= 0:
        raise ValueError("--top-k-disease must be a positive integer")
    if not 0.0 <= args.min_organ_classifier_proba <= 1.0:
        raise ValueError("--min-organ-classifier-proba must be between 0.0 and 1.0")

    print_receiver_header(args)

    connected_event = Event()
    wait_forever_event = Event()
    runtime_state = {"connect_error": None}
    client = create_mqtt_client(args.client_id)
    client.username_pw_set(args.username, args.password)

    def on_connect(client, userdata, flags, reason_code, properties=None) -> None:
        if not reason_code_is_success(reason_code):
            runtime_state["connect_error"] = (
                f"MQTT connection failed with reason code: {reason_code}"
            )
            connected_event.set()
            return

        subscribe_result, _message_id = client.subscribe(args.topic, qos=1)
        if subscribe_result != mqtt.MQTT_ERR_SUCCESS:
            runtime_state["connect_error"] = (
                f"MQTT subscribe failed with return code: {subscribe_result}"
            )

        connected_event.set()

    def on_message(client, userdata, message) -> None:
        message_result = {
            "topic": message.topic,
            "run_inference": bool(args.run_inference),
            "payload_validation": None,
            "inference_result": None,
            "status": "error",
        }

        try:
            try:
                decoded_payload = message.payload.decode("utf-8")
            except UnicodeDecodeError as exc:
                print()
                print("[PAYLOAD VALIDATION]")
                print(f"topic: {message.topic}")
                print("status: FAILED")
                print(f"- payload is not valid UTF-8: {exc}")
                message_result["payload_validation"] = {
                    "topic": message.topic,
                    "status": "FAILED",
                    "errors": [f"payload is not valid UTF-8: {exc}"],
                }
                if args.output_json:
                    write_json_result(args.output_json, message_result)
                if args.pretty_json:
                    print_pretty_json(message_result)
                return

            try:
                payload = json.loads(decoded_payload)
            except json.JSONDecodeError as exc:
                print()
                print("[PAYLOAD VALIDATION]")
                print(f"topic: {message.topic}")
                print("status: FAILED")
                print(f"- payload is not valid JSON: {exc}")
                message_result["payload_validation"] = {
                    "topic": message.topic,
                    "status": "FAILED",
                    "errors": [f"payload is not valid JSON: {exc}"],
                }
                if args.output_json:
                    write_json_result(args.output_json, message_result)
                if args.pretty_json:
                    print_pretty_json(message_result)
                return

            if not isinstance(payload, dict):
                print()
                print("[PAYLOAD VALIDATION]")
                print(f"topic: {message.topic}")
                print("status: FAILED")
                print("- JSON payload root must be an object")
                message_result["payload_validation"] = {
                    "topic": message.topic,
                    "status": "FAILED",
                    "errors": ["JSON payload root must be an object"],
                }
                if args.output_json:
                    write_json_result(args.output_json, message_result)
                if args.pretty_json:
                    print_pretty_json(message_result)
                return

            validation_result = validate_payload(payload)
            print_payload_validation_report(message.topic, payload, validation_result)
            message_result["payload_validation"] = build_validation_summary(
                message.topic,
                payload,
                validation_result,
            )
            if validation_result["errors"]:
                message_result["status"] = "validation_failed"
                if args.output_json:
                    write_json_result(args.output_json, message_result)
                if args.pretty_json:
                    print_pretty_json(message_result)
                return

            if not args.run_inference:
                message_result["status"] = "validation_ok"
                if args.output_json:
                    write_json_result(args.output_json, message_result)
                if args.pretty_json:
                    print_pretty_json(message_result)
                return

            try:
                inference_config = InferenceConfig(
                    top_k_disease=args.top_k_disease,
                    min_organ_classifier_proba=args.min_organ_classifier_proba,
                )
                inference_result = run_inference_from_payload(payload, config=inference_config)
                public_inference_result = build_public_inference_result(inference_result)
                message_result["inference_result"] = public_inference_result
                message_result["status"] = public_inference_result["processing_status"]

                print_organ_router_report(public_inference_result)
                print_faiss_report(public_inference_result)
                print_result_report(public_inference_result)
            except Exception as exc:
                print()
                print("[RESULT]")
                print("processing_status: inference_error")
                print("requires_review: true")
                print(f"error: {exc}")
                message_result["status"] = "inference_error"
                message_result["inference_result"] = {
                    "processing_status": "inference_error",
                    "requires_review": True,
                    "warnings": [str(exc)],
                }

            if args.output_json:
                write_json_result(args.output_json, message_result)
            if args.pretty_json:
                print_pretty_json(message_result)
        except Exception as exc:
            print()
            print("[RESULT]")
            print("processing_status: receiver_message_error")
            print("requires_review: true")
            print(f"error: {exc}")

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(args.host, args.port, keepalive=MQTT_KEEPALIVE_SECONDS)
        client.loop_start()

        if not connected_event.wait(CONNECT_TIMEOUT_SECONDS):
            raise TimeoutError(
                f"Timed out waiting for MQTT connection to {args.host}:{args.port}"
            )
        if runtime_state["connect_error"] is not None:
            raise ConnectionError(runtime_state["connect_error"])

        try:
            while True:
                wait_forever_event.wait(1.0)
        except KeyboardInterrupt:
            print()
            print("status: receiver stopped by user")
    finally:
        try:
            client.disconnect()
        finally:
            client.loop_stop()


if __name__ == "__main__":
    main()
