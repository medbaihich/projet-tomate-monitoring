from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Protocol
from urllib import error, request

from ai_worker.config import WorkerConfig


class ResultSink(Protocol):
    def emit(self, result: dict) -> None:
        """Handle a structured AI inference result."""


class ResultSinkPermanentError(RuntimeError):
    """Result delivery failed permanently and should be dead-lettered."""


class ResultSinkTransientError(RuntimeError):
    """Result delivery failed transiently and may be retried or requeued."""


class ConsoleResultSink:
    def __init__(self) -> None:
        self.logger = logging.getLogger("ai_worker.result_sink")

    def emit(self, result: dict) -> None:
        payload = json.dumps(result, ensure_ascii=False, sort_keys=True)
        self.logger.info("ai_worker_result=%s", payload)


@dataclass(frozen=True, slots=True)
class BackendResultSinkConfig:
    ingestion_url: str
    ingestion_token: str
    timeout_seconds: int
    max_attempts: int
    retry_delay_seconds: int


class BackendHttpResultSink:
    def __init__(self, config: BackendResultSinkConfig) -> None:
        self.config = config
        self.logger = logging.getLogger("ai_worker.result_sink")

    def emit(self, result: dict) -> None:
        payload = json.dumps(result).encode("utf-8")

        for attempt in range(1, self.config.max_attempts + 1):
            try:
                response_payload = self._post_payload(payload)
                self.logger.info(
                    "ai_worker_backend_delivery status=success created=%s duplicate=%s inspection_id=%s source_message_id=%s",
                    response_payload.get("created"),
                    response_payload.get("duplicate"),
                    response_payload.get("inspection_id"),
                    result.get("source_message_id"),
                )
                return
            except error.HTTPError as exc:
                response_body = _decode_response_body(exc)
                if 400 <= exc.code < 500:
                    raise ResultSinkPermanentError(
                        f"Backend ingestion rejected the AI result with status {exc.code}: {response_body}"
                    ) from exc
                if attempt >= self.config.max_attempts:
                    raise ResultSinkTransientError(
                        f"Backend ingestion returned transient status {exc.code}: {response_body}"
                    ) from exc
                self._sleep_before_retry(attempt, exc)
            except (error.URLError, TimeoutError, OSError) as exc:
                if attempt >= self.config.max_attempts:
                    raise ResultSinkTransientError(
                        f"Backend ingestion could not be reached after {attempt} attempts: {exc}"
                    ) from exc
                self._sleep_before_retry(attempt, exc)

    def _post_payload(self, payload: bytes) -> dict:
        http_request = request.Request(
            self.config.ingestion_url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.config.ingestion_token}",
            },
        )
        with request.urlopen(http_request, timeout=self.config.timeout_seconds) as response:
            response_body = response.read().decode("utf-8")
        return json.loads(response_body or "{}")

    def _sleep_before_retry(self, attempt: int, exc: Exception) -> None:
        self.logger.warning(
            "ai_worker_backend_delivery retrying attempt=%s max_attempts=%s reason=%s",
            attempt,
            self.config.max_attempts,
            exc,
        )
        time.sleep(self.config.retry_delay_seconds)


def _decode_response_body(exc: error.HTTPError) -> str:
    try:
        return exc.read().decode("utf-8")
    except Exception:
        return ""


def build_result_sink(config: WorkerConfig) -> ResultSink:
    normalized_name = config.result_sink.strip().lower()
    if normalized_name == "console":
        return ConsoleResultSink()
    if normalized_name == "backend_http":
        return BackendHttpResultSink(
            BackendResultSinkConfig(
                ingestion_url=config.backend_ingestion_url,
                ingestion_token=config.backend_ingestion_token,
                timeout_seconds=config.backend_timeout_seconds,
                max_attempts=config.backend_max_attempts,
                retry_delay_seconds=config.backend_retry_delay_seconds,
            )
        )

    raise ValueError(f"Unsupported AI worker result sink: {config.result_sink}")
