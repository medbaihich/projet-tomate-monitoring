from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _get_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        return default

    try:
        return int(raw_value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer") from exc


def _get_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        return default

    try:
        return float(raw_value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be a float") from exc


@dataclass(frozen=True, slots=True)
class WorkerConfig:
    rabbitmq_host: str
    rabbitmq_port: int
    rabbitmq_username: str
    rabbitmq_password: str
    rabbitmq_vhost: str
    request_exchange: str
    request_queue: str
    request_binding_key: str
    dead_letter_exchange: str
    dead_letter_queue: str
    dead_letter_routing_key: str
    prefetch_count: int
    heartbeat_seconds: int
    blocked_connection_timeout_seconds: int
    log_level: str
    result_sink: str
    backend_ingestion_url: str
    backend_ingestion_token: str
    backend_timeout_seconds: int
    backend_max_attempts: int
    backend_retry_delay_seconds: int
    assets_dir: Path
    top_k_disease: int
    min_organ_classifier_proba: float


def load_worker_config() -> WorkerConfig:
    assets_dir = Path(
        os.getenv("AI_WORKER_ASSETS_DIR", str(PROJECT_ROOT))
    ).expanduser().resolve()

    return WorkerConfig(
        rabbitmq_host=os.getenv("AI_WORKER_RABBITMQ_HOST", "rabbitmq"),
        rabbitmq_port=_get_int("AI_WORKER_RABBITMQ_PORT", 5672),
        rabbitmq_username=os.getenv("AI_WORKER_RABBITMQ_USERNAME", "tomato_mqtt"),
        rabbitmq_password=os.getenv("AI_WORKER_RABBITMQ_PASSWORD", "tomato_mqtt_pass"),
        rabbitmq_vhost=os.getenv("AI_WORKER_RABBITMQ_VHOST", "/"),
        request_exchange=os.getenv("AI_WORKER_REQUEST_EXCHANGE", "amq.topic"),
        request_queue=os.getenv(
            "AI_WORKER_REQUEST_QUEUE",
            "tomato.ai.inference.requests.v1",
        ),
        request_binding_key=os.getenv(
            "AI_WORKER_REQUEST_BINDING_KEY",
            "tomato.edge.v1.*.feature-vector",
        ),
        dead_letter_exchange=os.getenv(
            "AI_WORKER_DEAD_LETTER_EXCHANGE",
            "tomato.ai.inference.deadletter",
        ),
        dead_letter_queue=os.getenv(
            "AI_WORKER_DEAD_LETTER_QUEUE",
            "tomato.ai.inference.deadletter.v1",
        ),
        dead_letter_routing_key=os.getenv(
            "AI_WORKER_DEAD_LETTER_ROUTING_KEY",
            "tomato.ai.inference.deadletter.v1",
        ),
        prefetch_count=_get_int("AI_WORKER_PREFETCH_COUNT", 1),
        heartbeat_seconds=_get_int("AI_WORKER_HEARTBEAT_SECONDS", 60),
        blocked_connection_timeout_seconds=_get_int(
            "AI_WORKER_BLOCKED_CONNECTION_TIMEOUT_SECONDS",
            300,
        ),
        log_level=os.getenv("AI_WORKER_LOG_LEVEL", "INFO"),
        result_sink=os.getenv("AI_WORKER_RESULT_SINK", "console"),
        backend_ingestion_url=os.getenv(
            "AI_WORKER_BACKEND_INGESTION_URL",
            "http://backend:8000/api/v1/inspections/ingest-ai-result/",
        ),
        backend_ingestion_token=os.getenv(
            "AI_WORKER_BACKEND_INGESTION_TOKEN",
            "tomato-ai-worker-dev-token",
        ),
        backend_timeout_seconds=_get_int(
            "AI_WORKER_BACKEND_TIMEOUT_SECONDS",
            10,
        ),
        backend_max_attempts=_get_int(
            "AI_WORKER_BACKEND_MAX_ATTEMPTS",
            3,
        ),
        backend_retry_delay_seconds=_get_int(
            "AI_WORKER_BACKEND_RETRY_DELAY_SECONDS",
            2,
        ),
        assets_dir=assets_dir,
        top_k_disease=_get_int("AI_WORKER_TOP_K_DISEASE", 5),
        min_organ_classifier_proba=_get_float(
            "AI_WORKER_MIN_ORGAN_CLASSIFIER_PROBA",
            0.70,
        ),
    )


def configure_logging(log_level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
