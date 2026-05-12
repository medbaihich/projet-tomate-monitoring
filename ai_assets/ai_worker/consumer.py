from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT_DIR))

from ai_worker.config import WorkerConfig, configure_logging, load_worker_config
from ai_worker.payload_validator import PayloadValidationError, ValidatedPayload, validate_payload_bytes
from ai_worker.result_sink import (
    ResultSink,
    ResultSinkPermanentError,
    ResultSinkTransientError,
    build_result_sink,
)


class InferenceProcessingError(RuntimeError):
    """Permanent worker-side inference failure for the current message."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Consume Raspberry edge feature-vector payloads from RabbitMQ over AMQP "
            "and run FAISS inference."
        )
    )
    parser.add_argument(
        "--payload-file",
        help=(
            "Optional local JSON payload file for one-shot dry validation/inference "
            "without AMQP consumption."
        ),
    )
    parser.add_argument(
        "--routing-key",
        help=(
            "Optional AMQP routing key to associate with --payload-file. "
            "Used for topic/payload device consistency validation."
        ),
    )
    return parser.parse_args()


def _utc_now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _build_inference_metadata(payload: ValidatedPayload) -> dict[str, Any]:
    return {
        "device_id": payload.device_identifier,
        "image_id": payload.image_id or "",
        "feature_model": payload.feature_model,
        "message_type": payload.message_type,
        "timestamp": payload.captured_at,
        "vector_norm": payload.vector_norm,
        "l2_normalized": payload.l2_normalized,
    }


def _run_inference_from_validated_payload(
    payload: ValidatedPayload,
    config: WorkerConfig,
) -> dict[str, Any]:
    try:
        import numpy as np
        from ai_engine.vector_inference_service import InferenceConfig, run_inference_from_vector
    except Exception as exc:
        raise InferenceProcessingError(
            f"AI inference dependencies could not be loaded: {exc}"
        ) from exc

    try:
        vector = np.asarray(payload.feature_vector, dtype=np.float32)
        inference_config = InferenceConfig(
            assets_dir=str(config.assets_dir),
            top_k_disease=config.top_k_disease,
            min_organ_classifier_proba=config.min_organ_classifier_proba,
        )
        return run_inference_from_vector(
            vector,
            metadata=_build_inference_metadata(payload),
            config=inference_config,
        )
    except Exception as exc:
        raise InferenceProcessingError(str(exc)) from exc


def warm_up_inference_runtime(config: WorkerConfig) -> None:
    logger = logging.getLogger("ai_worker.consumer")
    logger.info("warming up ai inference runtime assets_dir=%s", config.assets_dir)

    try:
        from ai_engine.vector_inference_service import (
            InferenceConfig,
            warm_up_inference_assets,
        )
    except Exception as exc:
        raise RuntimeError(
            f"AI inference runtime could not be imported during startup warm-up: {exc}"
        ) from exc

    inference_config = InferenceConfig(
        assets_dir=str(config.assets_dir),
        top_k_disease=config.top_k_disease,
        min_organ_classifier_proba=config.min_organ_classifier_proba,
    )

    try:
        warm_up_inference_assets(inference_config)
    except Exception as exc:
        raise RuntimeError(
            f"AI inference runtime warm-up failed before message consumption: {exc}"
        ) from exc

    logger.info("ai inference runtime warm-up complete assets_dir=%s", config.assets_dir)


def _build_matches(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_matches: list[dict[str, Any]] = []
    for match in matches:
        metadata_json = {
            key: value
            for key, value in match.items()
            if key not in {"rank", "label", "score"}
        }
        normalized_matches.append(
            {
                "rank_order": int(match.get("rank", 0)),
                "matched_label": str(match.get("label", "")),
                "similarity_score": float(match.get("score", 0.0)),
                "metadata_json": metadata_json,
            }
        )
    return normalized_matches


def build_worker_result(
    payload: ValidatedPayload,
    inference_result: dict[str, Any],
    *,
    routing_key: str | None,
    received_at: str,
    processed_at: str,
) -> dict[str, Any]:
    top1_score = inference_result.get("top1_score")
    confidence_score = float(top1_score) if top1_score is not None else None

    extra_metadata: dict[str, Any] = {
        "routing_key": routing_key,
        "routing_device_identifier": payload.routing_device_identifier,
        "computed_vector_norm": payload.computed_vector_norm,
    }
    if payload.image_id:
        extra_metadata["image_id"] = payload.image_id
    if payload.edge_metadata is not None:
        extra_metadata["edge_metadata"] = payload.edge_metadata

    return {
        "schema_version": "ai-worker-result.v1",
        "message_type": "ai_inference_result",
        "source_schema_version": payload.schema_version,
        "source_message_id": payload.source_message_id,
        "device_identifier": payload.device_identifier,
        "captured_at": payload.captured_at,
        "received_at": received_at,
        "processed_at": processed_at,
        "feature_model": payload.feature_model,
        "feature_dim": payload.feature_dim,
        "l2_normalized": payload.l2_normalized,
        "declared_vector_norm": payload.vector_norm,
        "input_vector_norm": inference_result.get("input_vector_norm"),
        "normalized_vector_norm": inference_result.get("vector_norm"),
        "organ_type": inference_result.get("organ_type", ""),
        "organ_confidence": inference_result.get("organ_confidence"),
        "organ_status": inference_result.get("organ_status", ""),
        "top1_label": inference_result.get("top1_label", ""),
        "top1_score": top1_score,
        "confidence_score": confidence_score,
        "confidence_score_kind": inference_result.get("score_type", ""),
        "majority_label": inference_result.get("majority_label", ""),
        "final_label": inference_result.get("final_label", ""),
        "index_used": inference_result.get("index_used", ""),
        "metadata_used": inference_result.get("metadata_used", ""),
        "matches": _build_matches(inference_result.get("matches", [])),
        "processing_status": inference_result.get("processing_status", ""),
        "requires_review": bool(inference_result.get("requires_review", False)),
        "warnings": [
            *list(payload.validation_warnings),
            *list(inference_result.get("warnings", [])),
        ],
        "skip_reasons": list(inference_result.get("skip_reasons", [])),
        "extra_metadata": extra_metadata,
    }


def process_payload_bytes(
    payload_bytes: bytes,
    *,
    routing_key: str | None,
    config: WorkerConfig,
    result_sink: ResultSink,
) -> dict[str, Any]:
    received_at = _utc_now_iso()
    validated_payload = validate_payload_bytes(payload_bytes, routing_key=routing_key)
    inference_result = _run_inference_from_validated_payload(validated_payload, config)
    processed_at = _utc_now_iso()
    worker_result = build_worker_result(
        validated_payload,
        inference_result,
        routing_key=routing_key,
        received_at=received_at,
        processed_at=processed_at,
    )
    result_sink.emit(worker_result)
    return worker_result


def declare_topology(channel, config: WorkerConfig) -> None:
    channel.exchange_declare(
        exchange=config.dead_letter_exchange,
        exchange_type="direct",
        durable=True,
    )
    channel.queue_declare(queue=config.dead_letter_queue, durable=True)
    channel.queue_bind(
        exchange=config.dead_letter_exchange,
        queue=config.dead_letter_queue,
        routing_key=config.dead_letter_routing_key,
    )

    channel.queue_declare(
        queue=config.request_queue,
        durable=True,
        arguments={
            "x-dead-letter-exchange": config.dead_letter_exchange,
            "x-dead-letter-routing-key": config.dead_letter_routing_key,
        },
    )
    channel.queue_bind(
        exchange=config.request_exchange,
        queue=config.request_queue,
        routing_key=config.request_binding_key,
    )
    channel.basic_qos(prefetch_count=config.prefetch_count)


def run_consumer(config: WorkerConfig) -> None:
    try:
        import pika
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency 'pika'. Install worker dependencies first."
        ) from exc

    logger = logging.getLogger("ai_worker.consumer")
    result_sink = build_result_sink(config)

    credentials = pika.PlainCredentials(
        username=config.rabbitmq_username,
        password=config.rabbitmq_password,
    )
    parameters = pika.ConnectionParameters(
        host=config.rabbitmq_host,
        port=config.rabbitmq_port,
        virtual_host=config.rabbitmq_vhost,
        credentials=credentials,
        heartbeat=config.heartbeat_seconds,
        blocked_connection_timeout=config.blocked_connection_timeout_seconds,
    )

    logger.info(
        "starting ai worker host=%s port=%s queue=%s exchange=%s binding=%s dlq=%s",
        config.rabbitmq_host,
        config.rabbitmq_port,
        config.request_queue,
        config.request_exchange,
        config.request_binding_key,
        config.dead_letter_queue,
    )

    warm_up_inference_runtime(config)

    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    declare_topology(channel, config)

    def on_message(channel, method, properties, body) -> None:
        routing_key = getattr(method, "routing_key", None)
        delivery_tag = method.delivery_tag
        try:
            process_payload_bytes(
                body,
                routing_key=routing_key,
                config=config,
                result_sink=result_sink,
            )
            channel.basic_ack(delivery_tag=delivery_tag)
        except PayloadValidationError as exc:
            logger.warning(
                "dead-lettering permanently invalid payload routing_key=%s reason=%s",
                routing_key,
                exc,
            )
            channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        except InferenceProcessingError as exc:
            logger.exception(
                "dead-lettering inference failure routing_key=%s reason=%s",
                routing_key,
                exc,
            )
            channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        except ResultSinkPermanentError as exc:
            logger.warning(
                "dead-lettering permanently rejected backend delivery routing_key=%s reason=%s",
                routing_key,
                exc,
            )
            channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        except ResultSinkTransientError as exc:
            if getattr(method, "redelivered", False):
                logger.error(
                    "dead-lettering transient backend delivery failure after redelivery routing_key=%s reason=%s",
                    routing_key,
                    exc,
                )
                channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
            else:
                logger.warning(
                    "requeueing transient backend delivery failure routing_key=%s reason=%s",
                    routing_key,
                    exc,
                )
                channel.basic_nack(delivery_tag=delivery_tag, requeue=True)
        except Exception as exc:
            logger.exception(
                "dead-lettering unexpected worker failure routing_key=%s reason=%s",
                routing_key,
                exc,
            )
            channel.basic_reject(delivery_tag=delivery_tag, requeue=False)

    channel.basic_consume(
        queue=config.request_queue,
        on_message_callback=on_message,
        auto_ack=False,
    )

    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        logger.info("worker stopped by user")
    finally:
        if channel.is_open:
            channel.close()
        if connection.is_open:
            connection.close()


def run_payload_file_once(
    payload_file: Path,
    *,
    routing_key: str | None,
    config: WorkerConfig,
) -> dict[str, Any]:
    payload_bytes = payload_file.read_bytes()
    result_sink = build_result_sink(config)
    return process_payload_bytes(
        payload_bytes,
        routing_key=routing_key,
        config=config,
        result_sink=result_sink,
    )


def main() -> None:
    args = parse_args()
    config = load_worker_config()
    configure_logging(config.log_level)

    if args.payload_file:
        payload_path = Path(args.payload_file).expanduser().resolve()
        if not payload_path.exists():
            raise SystemExit(f"Payload file does not exist: {payload_path}")
        run_payload_file_once(
            payload_path,
            routing_key=args.routing_key,
            config=config,
        )
        return

    run_consumer(config)


if __name__ == "__main__":
    main()
