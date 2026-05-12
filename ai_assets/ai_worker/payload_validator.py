from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


SUPPORTED_SCHEMA_VERSION = "raspberry-edge-payload.v1"
SUPPORTED_MESSAGE_TYPE = "feature_vector"
EXPECTED_FEATURE_DIM = 1280
MIN_ACCEPTED_NORM = 0.98
MAX_ACCEPTED_NORM = 1.02
ROUTING_KEY_PREFIX = ("tomato", "edge", "v1")
ROUTING_KEY_SUFFIX = "feature-vector"


class PayloadValidationError(ValueError):
    """Permanent payload validation failure."""


@dataclass(frozen=True, slots=True)
class ValidatedPayload:
    schema_version: str
    message_type: str
    source_message_id: str
    device_identifier: str
    captured_at: str
    image_id: str | None
    feature_model: str
    feature_dim: int
    l2_normalized: bool
    vector_norm: float | None
    feature_vector: list[float]
    edge_metadata: dict[str, Any] | None
    routing_device_identifier: str | None
    computed_vector_norm: float
    validation_warnings: list[str]


def _require_non_empty_string(payload: dict[str, Any], field_name: str) -> str:
    value = payload.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise PayloadValidationError(f"{field_name} must be a non-empty string")
    return value.strip()


def _parse_iso8601_timestamp(value: str) -> str:
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise PayloadValidationError("captured_at must be a valid ISO-8601 timestamp") from exc

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise PayloadValidationError("captured_at must include timezone information")

    return (
        parsed.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def extract_device_identifier_from_routing_key(routing_key: str | None) -> str | None:
    if not routing_key:
        return None

    parts = routing_key.split(".")
    if len(parts) != 5:
        return None

    if tuple(parts[:3]) != ROUTING_KEY_PREFIX or parts[4] != ROUTING_KEY_SUFFIX:
        return None

    return parts[3] or None


def _validate_vector(payload: dict[str, Any]) -> tuple[list[float], float, float | None, list[str]]:
    feature_vector = payload.get("feature_vector")
    if not isinstance(feature_vector, list):
        raise PayloadValidationError("feature_vector must be a list")

    if len(feature_vector) != EXPECTED_FEATURE_DIM:
        raise PayloadValidationError(
            f"feature_vector must contain exactly {EXPECTED_FEATURE_DIM} values"
        )

    converted_values: list[float] = []
    squared_norm = 0.0
    for index, raw_value in enumerate(feature_vector):
        if isinstance(raw_value, bool):
            raise PayloadValidationError(
                f"feature_vector[{index}] must be numeric, not boolean"
            )

        try:
            numeric_value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise PayloadValidationError(
                f"feature_vector[{index}] must be float-compatible"
            ) from exc

        if not math.isfinite(numeric_value):
            raise PayloadValidationError(
                f"feature_vector[{index}] must not be NaN or Infinity"
            )

        converted_values.append(numeric_value)
        squared_norm += numeric_value * numeric_value

    computed_norm = math.sqrt(squared_norm)
    if not MIN_ACCEPTED_NORM <= computed_norm <= MAX_ACCEPTED_NORM:
        raise PayloadValidationError(
            "feature_vector norm must be within "
            f"{MIN_ACCEPTED_NORM:.2f}..{MAX_ACCEPTED_NORM:.2f}; got {computed_norm:.6f}"
        )

    declared_norm = payload.get("vector_norm")
    if declared_norm is None:
        return converted_values, computed_norm, None, []

    if isinstance(declared_norm, bool):
        raise PayloadValidationError("vector_norm must be numeric when present")

    try:
        declared_norm_value = float(declared_norm)
    except (TypeError, ValueError) as exc:
        raise PayloadValidationError("vector_norm must be numeric when present") from exc

    if not math.isfinite(declared_norm_value):
        raise PayloadValidationError("vector_norm must not be NaN or Infinity")

    warnings: list[str] = []
    if abs(declared_norm_value - computed_norm) > 0.02:
        warnings.append(
            "declared vector_norm differs meaningfully from computed norm "
            f"({declared_norm_value:.6f} vs {computed_norm:.6f})"
        )

    return converted_values, computed_norm, declared_norm_value, warnings


def validate_payload_bytes(
    payload_bytes: bytes,
    *,
    routing_key: str | None = None,
) -> ValidatedPayload:
    try:
        decoded_payload = payload_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise PayloadValidationError("payload is not valid UTF-8") from exc

    try:
        payload = json.loads(decoded_payload)
    except json.JSONDecodeError as exc:
        raise PayloadValidationError("payload is not valid JSON") from exc

    if not isinstance(payload, dict):
        raise PayloadValidationError("payload JSON root must be an object")

    schema_version = _require_non_empty_string(payload, "schema_version")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        raise PayloadValidationError(
            f"unsupported schema_version: {schema_version}"
        )

    message_type = _require_non_empty_string(payload, "message_type")
    if message_type != SUPPORTED_MESSAGE_TYPE:
        raise PayloadValidationError(
            f"unsupported message_type: {message_type}"
        )

    source_message_id = _require_non_empty_string(payload, "source_message_id")
    device_identifier = _require_non_empty_string(payload, "device_identifier")
    captured_at = _parse_iso8601_timestamp(
        _require_non_empty_string(payload, "captured_at")
    )
    feature_model = _require_non_empty_string(payload, "feature_model")

    feature_dim = payload.get("feature_dim")
    if feature_dim != EXPECTED_FEATURE_DIM:
        raise PayloadValidationError(
            f"feature_dim must equal {EXPECTED_FEATURE_DIM}"
        )

    l2_normalized = payload.get("l2_normalized")
    if not isinstance(l2_normalized, bool):
        raise PayloadValidationError("l2_normalized must be a boolean")
    if l2_normalized is not True:
        raise PayloadValidationError("l2_normalized must be true for the v1 contract")

    image_id = payload.get("image_id")
    if image_id is not None:
        if not isinstance(image_id, str) or not image_id.strip():
            raise PayloadValidationError("image_id must be a non-empty string when present")
        image_id = image_id.strip()

    edge_metadata = payload.get("edge_metadata")
    if edge_metadata is not None and not isinstance(edge_metadata, dict):
        raise PayloadValidationError("edge_metadata must be an object when present")

    feature_vector, computed_norm, vector_norm, warnings = _validate_vector(payload)
    routing_device_identifier = extract_device_identifier_from_routing_key(routing_key)
    if (
        routing_device_identifier is not None
        and routing_device_identifier != device_identifier
    ):
        raise PayloadValidationError(
            "routing-key device identifier does not match payload.device_identifier "
            f"({routing_device_identifier} != {device_identifier})"
        )

    return ValidatedPayload(
        schema_version=schema_version,
        message_type=message_type,
        source_message_id=source_message_id,
        device_identifier=device_identifier,
        captured_at=captured_at,
        image_id=image_id,
        feature_model=feature_model,
        feature_dim=feature_dim,
        l2_normalized=l2_normalized,
        vector_norm=vector_norm,
        feature_vector=feature_vector,
        edge_metadata=edge_metadata,
        routing_device_identifier=routing_device_identifier,
        computed_vector_norm=computed_norm,
        validation_warnings=warnings,
    )
