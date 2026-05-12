import argparse
import json
from pathlib import Path
from threading import Event

try:
    import paho.mqtt.client as mqtt
except ImportError as exc:
    raise SystemExit(
        "Missing dependency 'paho-mqtt'. Install it with: pip install paho-mqtt"
    ) from exc


DEFAULT_HOST = "localhost"
DEFAULT_PORT = 1883
DEFAULT_USERNAME = "tomato_mqtt"
DEFAULT_PASSWORD = "tomato_mqtt_pass"
DEFAULT_TOPIC = "tomato/edge/v1/tomato-edge-01/feature-vector"
DEFAULT_CLIENT_ID = "pc-payload-file-publisher"
MQTT_KEEPALIVE_SECONDS = 60
CONNECT_TIMEOUT_SECONDS = 10
PUBLISH_TIMEOUT_SECONDS = 10


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Publish one JSON payload file to RabbitMQ MQTT."
    )
    parser.add_argument("--payload", required=True, help="Path to the JSON payload file.")
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
        help=f"MQTT topic to publish to. Default: {DEFAULT_TOPIC}",
    )
    parser.add_argument(
        "--client-id",
        default=DEFAULT_CLIENT_ID,
        help=f"MQTT client id. Default: {DEFAULT_CLIENT_ID}",
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


def load_payload(payload_path: Path) -> tuple[dict, bytes]:
    if not payload_path.exists():
        raise FileNotFoundError(f"JSON payload file does not exist: {payload_path}")

    with payload_path.open("r", encoding="utf-8") as file_handle:
        payload = json.load(file_handle)

    if not isinstance(payload, dict):
        raise ValueError("JSON payload root must be an object")

    payload_text = json.dumps(payload, ensure_ascii=False)
    return payload, payload_text.encode("utf-8")


def print_publish_header(args: argparse.Namespace, payload_path: Path, payload: dict) -> None:
    device_identifier = payload.get("device_identifier") or payload.get("device_id", "<missing>")
    source_message_id = payload.get("source_message_id", "<missing>")
    captured_at = payload.get("captured_at") or payload.get("timestamp", "<missing>")

    print("[MQTT PUBLISH]")
    print(f"broker: {args.host}:{args.port}")
    print(f"topic: {args.topic}")
    print(f"payload_path: {payload_path}")
    print(f"source_message_id: {source_message_id}")
    print(f"device_identifier: {device_identifier}")
    print(f"captured_at: {captured_at}")
    print(f"message_type: {payload.get('message_type', '<missing>')}")
    print(f"image_id: {payload.get('image_id', '<missing>')}")
    print(f"feature_dim: {payload.get('feature_dim', '<missing>')}")


def main() -> None:
    args = parse_args()
    payload_path = Path(args.payload).expanduser().resolve()
    payload, payload_bytes = load_payload(payload_path)
    print_publish_header(args, payload_path, payload)

    connected_event = Event()
    published_event = Event()
    runtime_state = {"connect_error": None}
    client = create_mqtt_client(args.client_id)
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
        client.connect(args.host, args.port, keepalive=MQTT_KEEPALIVE_SECONDS)
        client.loop_start()

        if not connected_event.wait(CONNECT_TIMEOUT_SECONDS):
            raise TimeoutError(
                f"Timed out waiting for MQTT connection to {args.host}:{args.port}"
            )
        if runtime_state["connect_error"] is not None:
            raise ConnectionError(runtime_state["connect_error"])

        publish_result = client.publish(args.topic, payload=payload_bytes, qos=1)
        if publish_result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(
                f"MQTT publish failed immediately with return code: {publish_result.rc}"
            )

        if not published_event.wait(PUBLISH_TIMEOUT_SECONDS):
            raise TimeoutError("Timed out waiting for MQTT publish acknowledgement")

        print("publish success")
    finally:
        try:
            client.disconnect()
        finally:
            client.loop_stop()


if __name__ == "__main__":
    main()
