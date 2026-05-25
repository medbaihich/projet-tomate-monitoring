from __future__ import annotations

import hashlib
import json
import mimetypes
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from shutil import copy2
from typing import Any
from urllib.parse import urljoin

from PIL import Image


DEFAULT_IMAGE_STORE_DIR = "~/tomato-edge/evidence-images"
DEFAULT_UPLOAD_TIMEOUT_SECONDS = 30
SUPPORTED_COMMAND_SCHEMA_VERSION = "evidence-image-request.v1"
SUPPORTED_COMMAND_TYPE = "image_request"


def resolve_image_store_dir(value: str | None = None) -> Path:
    configured_value = value or os.getenv("EDGE_IMAGE_STORE_DIR") or DEFAULT_IMAGE_STORE_DIR
    return Path(configured_value).expanduser().resolve()


def parse_utc_timestamp(value: str) -> datetime:
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"

    parsed = datetime.fromisoformat(candidate)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp must include timezone information")
    return parsed.astimezone(timezone.utc)


def isoformat_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sanitize_filename_component(value: str, fallback: str = "artifact") -> str:
    allowed_characters = []
    for character in str(value):
        if character.isalnum() or character in {"-", "_", "."}:
            allowed_characters.append(character)
        else:
            allowed_characters.append("-")

    sanitized = "".join(allowed_characters).strip("-._")
    return sanitized or fallback


def compute_sha256_for_file(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with file_path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _guess_extension_from_image(source_path: Path) -> str:
    if source_path.suffix:
        return source_path.suffix.lower()

    try:
        with Image.open(source_path) as image:
            image_format = (image.format or "").upper()
    except OSError:
        return ".bin"

    format_extensions = {
        "JPEG": ".jpg",
        "PNG": ".png",
        "WEBP": ".webp",
        "BMP": ".bmp",
        "TIFF": ".tiff",
    }
    return format_extensions.get(image_format, ".bin")


def derive_local_image_ref(
    *,
    source_message_id: str,
    captured_at: str,
    source_path: Path,
) -> str:
    captured_date = parse_utc_timestamp(captured_at).date().isoformat()
    safe_source_message_id = sanitize_filename_component(
        source_message_id,
        fallback="capture",
    )
    filename = f"{safe_source_message_id}{_guess_extension_from_image(source_path)}"
    return str(PurePosixPath(captured_date) / filename)


def safe_resolve_local_image_ref(*, image_store_dir: Path, local_image_ref: str) -> Path:
    normalized_ref = str(local_image_ref or "").strip().replace("\\", "/")
    if not normalized_ref:
        raise ValueError("local_image_ref must be a non-empty relative path")

    relative_ref = PurePosixPath(normalized_ref)
    if relative_ref.is_absolute():
        raise ValueError("local_image_ref must not be absolute")

    if any(part in {"", ".", ".."} for part in relative_ref.parts):
        raise ValueError("local_image_ref must not contain unsafe path traversal segments")

    resolved_store_dir = image_store_dir.expanduser().resolve()
    resolved_path = (resolved_store_dir / Path(*relative_ref.parts)).resolve()
    if not resolved_path.is_relative_to(resolved_store_dir):
        raise ValueError("local_image_ref resolves outside the configured image store directory")

    return resolved_path


def ensure_image_stored(
    *,
    source_path: Path,
    image_store_dir: Path,
    local_image_ref: str,
) -> Path:
    resolved_source_path = source_path.expanduser().resolve()
    if not resolved_source_path.exists():
        raise FileNotFoundError(f"source image does not exist: {resolved_source_path}")

    destination_path = safe_resolve_local_image_ref(
        image_store_dir=image_store_dir,
        local_image_ref=local_image_ref,
    )
    destination_path.parent.mkdir(parents=True, exist_ok=True)

    if destination_path.exists():
        return destination_path

    copy2(resolved_source_path, destination_path)
    return destination_path


def inspect_stored_image(file_path: Path) -> dict[str, Any]:
    with Image.open(file_path) as image:
        width, height = image.size
        detected_mime_type = Image.MIME.get(image.format or "", "")

    mime_type = detected_mime_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return {
        "image_sha256": compute_sha256_for_file(file_path),
        "mime_type": mime_type,
        "size_bytes": file_path.stat().st_size,
        "width": width,
        "height": height,
    }


def build_capture_artifact(
    *,
    source_path: Path,
    image_store_dir: Path,
    source_message_id: str,
    image_id: str,
    captured_at: str,
    retention_hours: int | None = None,
) -> tuple[dict[str, Any], Path]:
    local_image_ref = derive_local_image_ref(
        source_message_id=source_message_id,
        captured_at=captured_at,
        source_path=source_path,
    )
    stored_image_path = ensure_image_stored(
        source_path=source_path,
        image_store_dir=image_store_dir,
        local_image_ref=local_image_ref,
    )
    image_details = inspect_stored_image(stored_image_path)
    captured_at_dt = parse_utc_timestamp(captured_at)
    retention_until = None
    if retention_hours is not None:
        retention_until = isoformat_utc(captured_at_dt + timedelta(hours=retention_hours))

    capture_artifact = {
        "image_id": image_id,
        "local_image_ref": local_image_ref,
        "image_sha256": image_details["image_sha256"],
        "mime_type": image_details["mime_type"],
        "size_bytes": image_details["size_bytes"],
        "width": image_details["width"],
        "height": image_details["height"],
        "retention_until": retention_until,
        "upload_requested": False,
    }
    return capture_artifact, stored_image_path


def validate_image_request_command(
    command_payload: dict[str, Any],
    *,
    expected_device_identifier: str | None,
) -> dict[str, Any]:
    if not isinstance(command_payload, dict):
        raise ValueError("command payload must be a JSON object")

    command_schema_version = str(command_payload.get("command_schema_version", "")).strip()
    if command_schema_version != SUPPORTED_COMMAND_SCHEMA_VERSION:
        raise ValueError(
            f"command_schema_version must be {SUPPORTED_COMMAND_SCHEMA_VERSION}"
        )

    command_type = str(command_payload.get("command_type", "")).strip()
    if command_type != SUPPORTED_COMMAND_TYPE:
        raise ValueError(f"command_type must be {SUPPORTED_COMMAND_TYPE}")

    request_id = str(command_payload.get("request_id", "")).strip()
    if not request_id:
        raise ValueError("request_id is required")

    source_message_id = str(command_payload.get("source_message_id", "")).strip()
    if not source_message_id:
        raise ValueError("source_message_id is required")

    device_identifier = str(command_payload.get("device_identifier", "")).strip()
    if not device_identifier:
        raise ValueError("device_identifier is required")

    if expected_device_identifier and device_identifier != expected_device_identifier:
        raise ValueError(
            "command device_identifier does not match the configured device identifier"
        )

    local_image_ref = str(command_payload.get("local_image_ref", "")).strip()
    image_id = str(command_payload.get("image_id", "")).strip()
    reason = str(command_payload.get("reason", "")).strip()
    upload_path = str(command_payload.get("upload_path", "")).strip()
    upload_url = str(command_payload.get("upload_url", "")).strip()
    if not upload_path and not upload_url:
        raise ValueError("command must provide upload_path or upload_url")

    return {
        "command_schema_version": command_schema_version,
        "command_type": command_type,
        "request_id": request_id,
        "inspection_id": str(command_payload.get("inspection_id", "")).strip(),
        "source_message_id": source_message_id,
        "device_identifier": device_identifier,
        "image_id": image_id,
        "local_image_ref": local_image_ref,
        "reason": reason,
        "requested_at": str(command_payload.get("requested_at", "")).strip(),
        "expires_at": command_payload.get("expires_at"),
        "upload_path": upload_path,
        "upload_url": upload_url,
    }


def find_stored_image_by_source_message_id(
    *,
    image_store_dir: Path,
    source_message_id: str,
) -> tuple[Path, str]:
    resolved_store_dir = image_store_dir.expanduser().resolve()
    safe_source_message_id = sanitize_filename_component(
        source_message_id,
        fallback="capture",
    )
    matches = sorted(resolved_store_dir.rglob(f"{safe_source_message_id}.*"))
    if not matches:
        raise FileNotFoundError(
            f"no stored evidence image found for source_message_id {source_message_id}"
        )
    if len(matches) > 1:
        raise FileExistsError(
            f"multiple stored evidence images found for source_message_id {source_message_id}"
        )

    resolved_path = matches[0].resolve()
    if not resolved_path.is_relative_to(resolved_store_dir):
        raise ValueError("derived stored image path resolves outside the configured image store directory")

    relative_ref = resolved_path.relative_to(resolved_store_dir).as_posix()
    return resolved_path, relative_ref


def resolve_command_image_path(
    *,
    image_store_dir: Path,
    validated_command: dict[str, Any],
) -> tuple[Path, str]:
    local_image_ref = validated_command.get("local_image_ref", "")
    if local_image_ref:
        resolved_path = safe_resolve_local_image_ref(
            image_store_dir=image_store_dir,
            local_image_ref=local_image_ref,
        )
        if not resolved_path.exists():
            raise FileNotFoundError(
                f"stored evidence image does not exist for local_image_ref {local_image_ref}"
            )
        return resolved_path, local_image_ref.replace("\\", "/")

    return find_stored_image_by_source_message_id(
        image_store_dir=image_store_dir,
        source_message_id=validated_command["source_message_id"],
    )


def build_upload_url(*, command_upload_url: str, upload_path: str, backend_base_url: str | None) -> str:
    if command_upload_url:
        return command_upload_url

    base_url = str(backend_base_url or "").strip()
    path = str(upload_path or "").strip()
    if not base_url or not path:
        raise ValueError("cannot build upload URL without backend base URL and upload_path")

    normalized_base_url = f"{base_url.rstrip('/')}/"
    return urljoin(normalized_base_url, path.lstrip("/"))


def upload_evidence_image(
    *,
    upload_url: str,
    upload_token: str,
    validated_command: dict[str, Any],
    image_path: Path,
    image_sha256: str,
    timeout_seconds: int = DEFAULT_UPLOAD_TIMEOUT_SECONDS,
    dry_run: bool = False,
) -> dict[str, Any]:
    multipart_fields = {
        "request_id": validated_command["request_id"],
        "source_message_id": validated_command["source_message_id"],
        "device_identifier": validated_command["device_identifier"],
        "image_sha256": image_sha256,
    }

    if dry_run:
        return {
            "dry_run": True,
            "upload_url": upload_url,
            "headers": {
                "Authorization": "Bearer <redacted>",
            },
            "multipart_fields": multipart_fields,
            "image_path": str(image_path),
        }

    if not upload_token:
        raise ValueError("upload token is required for live evidence image upload")

    try:
        import requests
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency 'requests'. Install it with: pip install requests"
        ) from exc

    mime_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
    with image_path.open("rb") as image_handle:
        response = requests.post(
            upload_url,
            headers={
                "Authorization": f"Bearer {upload_token}",
            },
            data=multipart_fields,
            files={
                "image": (image_path.name, image_handle, mime_type),
            },
            timeout=timeout_seconds,
        )

    response.raise_for_status()
    response_payload: Any
    try:
        response_payload = response.json()
    except json.JSONDecodeError:
        response_payload = response.text

    return {
        "dry_run": False,
        "status_code": response.status_code,
        "response": response_payload,
        "multipart_fields": multipart_fields,
        "upload_url": upload_url,
    }
