from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from threading import Event

from evidence_image_utils import (
    build_upload_url,
    compute_sha256_for_file,
    resolve_command_image_path,
    resolve_image_store_dir,
    upload_evidence_image,
    validate_image_request_command,
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
DEFAULT_QOS = 1
DEFAULT_KEEPALIVE = 60
DEFAULT_TIMEOUT_SECONDS = 30
CONNECT_TIMEOUT_SECONDS = 10


def default_command_topic_for_device(device_identifier: str) -> str:
    return f"tomato/edge/v1/{device_identifier}/commands/image-request"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Listen for evidence-image request commands over MQTT and upload the "
            "corresponding stored image to the backend."
        )
    )
    parser.add_argument(
        "--host",
        help="MQTT broker host. Required unless --process-command-json is used.",
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
        default=None,
        help=(
            "MQTT topic to subscribe to. Default: "
            "tomato/edge/v1/{device_identifier}/commands/image-request"
        ),
    )
    parser.add_argument(
        "--device-identifier",
        default=DEFAULT_DEVICE_IDENTIFIER,
        help=f"Configured Raspberry device identifier. Default: {DEFAULT_DEVICE_IDENTIFIER}",
    )
    parser.add_argument(
        "--client-id",
        default=None,
        help="Optional MQTT client id. Default: raspberry-{device_identifier}-evidence-agent",
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
        "--image-store-dir",
        default=os.getenv("EDGE_IMAGE_STORE_DIR"),
        help=(
            "Directory containing stored evidence images. Default: "
            "EDGE_IMAGE_STORE_DIR or ~/tomato-edge/evidence-images."
        ),
    )
    parser.add_argument(
        "--backend-base-url",
        default=os.getenv("EDGE_BACKEND_BASE_URL"),
        help=(
            "Base backend URL used when the command only includes upload_path. "
            "Example: http://backend-host or http://backend-host:8000"
        ),
    )
    parser.add_argument(
        "--upload-token",
        default=os.getenv("EDGE_EVIDENCE_UPLOAD_TOKEN"),
        help="Bearer token used for backend evidence-image upload.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"HTTP upload timeout in seconds. Default: {DEFAULT_TIMEOUT_SECONDS}",
    )
    parser.add_argument(
        "--process-command-json",
        default=None,
        help="Process one command JSON file from disk without connecting to MQTT.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate, resolve, and print the upload payload without performing HTTP upload.",
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


def load_command_json(command_path: Path) -> dict:
    with command_path.open("r", encoding="utf-8") as file_handle:
        payload = json.load(file_handle)
    if not isinstance(payload, dict):
        raise ValueError("command JSON root must be an object")
    return payload


def process_command(
    command_payload: dict,
    *,
    expected_device_identifier: str,
    image_store_dir: Path,
    backend_base_url: str | None,
    upload_token: str | None,
    timeout_seconds: int,
    dry_run: bool,
) -> dict:
    print("[COMMAND]")
    print("status: received")

    validated_command = validate_image_request_command(
        command_payload,
        expected_device_identifier=expected_device_identifier,
    )
    print(f"request_id: {validated_command['request_id']}")
    print(f"source_message_id: {validated_command['source_message_id']}")
    print(f"device_identifier: {validated_command['device_identifier']}")
    print(f"reason: {validated_command['reason'] or 'N/A'}")

    image_path, local_image_ref = resolve_command_image_path(
        image_store_dir=image_store_dir,
        validated_command=validated_command,
    )
    image_sha256 = compute_sha256_for_file(image_path)
    upload_url = build_upload_url(
        command_upload_url=validated_command["upload_url"],
        upload_path=validated_command["upload_path"],
        backend_base_url=backend_base_url,
    )

    print("[IMAGE]")
    print("status: resolved")
    print(f"local_image_ref: {local_image_ref}")
    print(f"image_path: {image_path}")
    print(f"image_sha256: {image_sha256}")

    print("[UPLOAD]")
    print("status: started")
    print(f"upload_url: {upload_url}")
    upload_result = upload_evidence_image(
        upload_url=upload_url,
        upload_token=upload_token or "",
        validated_command=validated_command,
        image_path=image_path,
        image_sha256=image_sha256,
        timeout_seconds=timeout_seconds,
        dry_run=dry_run,
    )

    if dry_run:
        print("status: dry-run")
        print(json.dumps(upload_result, indent=2))
        return upload_result

    print("status: success")
    print(json.dumps(upload_result["response"], indent=2, ensure_ascii=False))
    return upload_result


def run_offline_command(args: argparse.Namespace) -> None:
    command_path = Path(args.process_command_json).expanduser().resolve()
    command_payload = load_command_json(command_path)
    image_store_dir = resolve_image_store_dir(args.image_store_dir)

    print("[AGENT]")
    print("mode: offline-command")
    print(f"command_file: {command_path}")
    print(f"image_store_dir: {image_store_dir}")

    process_command(
        command_payload,
        expected_device_identifier=args.device_identifier,
        image_store_dir=image_store_dir,
        backend_base_url=args.backend_base_url,
        upload_token=args.upload_token,
        timeout_seconds=args.timeout_seconds,
        dry_run=args.dry_run,
    )


def run_mqtt_agent(args: argparse.Namespace) -> None:
    if not args.host:
        raise ValueError("--host is required unless --process-command-json is used")

    image_store_dir = resolve_image_store_dir(args.image_store_dir)
    client_identifier = args.client_id or f"raspberry-{args.device_identifier}-evidence-agent"
    topic = args.topic or default_command_topic_for_device(args.device_identifier)
    connected_event = Event()
    runtime_state = {"connect_error": None}
    client = create_mqtt_client(client_identifier)
    client.username_pw_set(args.username, args.password)

    print("[AGENT]")
    print("mode: mqtt-listener")
    print(f"device_identifier: {args.device_identifier}")
    print(f"broker: {args.host}:{args.port}")
    print(f"client_id: {client_identifier}")
    print(f"topic: {topic}")
    print(f"qos: {args.qos}")
    print(f"image_store_dir: {image_store_dir}")
    if args.backend_base_url:
        print(f"backend_base_url: {args.backend_base_url}")
    print("waiting_for_commands: true")

    def on_connect(client, userdata, flags, reason_code, properties=None) -> None:
        if not reason_code_is_success(reason_code):
            runtime_state["connect_error"] = f"MQTT connection failed with reason code: {reason_code}"
            connected_event.set()
            return

        client.subscribe(topic, qos=args.qos)
        connected_event.set()
        print("[MQTT]")
        print("status: connected")

    def on_message(client, userdata, message) -> None:
        print("[MQTT]")
        print(f"message_topic: {message.topic}")
        try:
            command_payload = json.loads(message.payload.decode("utf-8"))
            process_command(
                command_payload,
                expected_device_identifier=args.device_identifier,
                image_store_dir=image_store_dir,
                backend_base_url=args.backend_base_url,
                upload_token=args.upload_token,
                timeout_seconds=args.timeout_seconds,
                dry_run=args.dry_run,
            )
        except Exception as exc:  # noqa: BLE001
            print("[UPLOAD]")
            print("status: failed")
            print(f"error: {exc}")

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(args.host, args.port, keepalive=args.keepalive)
        client.loop_start()
        if not connected_event.wait(CONNECT_TIMEOUT_SECONDS):
            raise TimeoutError(
                f"Timed out waiting for MQTT connection to {args.host}:{args.port}"
            )
        if runtime_state["connect_error"] is not None:
            raise ConnectionError(runtime_state["connect_error"])

        Event().wait()
    except KeyboardInterrupt:
        print("[AGENT]")
        print("status: stopping")
    finally:
        try:
            client.disconnect()
        finally:
            client.loop_stop()


def main() -> None:
    args = parse_args()
    if args.process_command_json:
        run_offline_command(args)
        return

    run_mqtt_agent(args)


if __name__ == "__main__":
    try:
        main()
    except (ConnectionError, FileNotFoundError, OSError, RuntimeError, TimeoutError, ValueError) as exc:
        print("[AGENT]")
        print("status: failed")
        print(f"error: {exc}")
        raise SystemExit(1) from exc
