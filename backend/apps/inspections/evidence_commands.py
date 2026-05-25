import json
from dataclasses import dataclass
from urllib.parse import urljoin

from django.conf import settings
from django.urls import reverse


@dataclass(frozen=True, slots=True)
class EvidenceImageCommandPublishResult:
    published: bool
    exchange: str
    routing_key: str
    payload: dict


def build_evidence_image_request_command_payload(*, evidence_request):
    upload_path = reverse("inspection-evidence-image-upload")
    upload_url = _build_evidence_upload_url(upload_path)

    payload = {
        "command_schema_version": "evidence-image-request.v1",
        "command_type": "image_request",
        "request_id": str(evidence_request.id),
        "inspection_id": str(evidence_request.inspection_id),
        "source_message_id": evidence_request.source_message_id,
        "device_identifier": evidence_request.device.identifier,
        "image_id": evidence_request.image_id or "",
        "local_image_ref": evidence_request.local_image_ref or "",
        "reason": evidence_request.reason,
        "requested_at": evidence_request.requested_at.isoformat() if evidence_request.requested_at else None,
        "expires_at": evidence_request.expires_at.isoformat() if evidence_request.expires_at else None,
        "upload_path": upload_path,
    }

    if upload_url:
        payload["upload_url"] = upload_url

    return payload


def build_evidence_image_request_routing_key(*, device_identifier):
    return settings.EVIDENCE_IMAGE_COMMAND_ROUTING_KEY_TEMPLATE.format(
        device_identifier=device_identifier,
    )


def publish_evidence_image_request_command(*, evidence_request):
    import pika

    payload = build_evidence_image_request_command_payload(
        evidence_request=evidence_request,
    )
    exchange = settings.EVIDENCE_IMAGE_COMMAND_EXCHANGE
    routing_key = build_evidence_image_request_routing_key(
        device_identifier=evidence_request.device.identifier,
    )
    body = json.dumps(payload).encode("utf-8")
    credentials = pika.PlainCredentials(
        settings.EVIDENCE_IMAGE_COMMAND_RABBITMQ_USERNAME,
        settings.EVIDENCE_IMAGE_COMMAND_RABBITMQ_PASSWORD,
    )
    parameters = pika.ConnectionParameters(
        host=settings.EVIDENCE_IMAGE_COMMAND_RABBITMQ_HOST,
        port=settings.EVIDENCE_IMAGE_COMMAND_RABBITMQ_PORT,
        virtual_host=settings.EVIDENCE_IMAGE_COMMAND_RABBITMQ_VHOST,
        credentials=credentials,
    )

    connection = pika.BlockingConnection(parameters)
    try:
        channel = connection.channel()
        channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=body,
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
            ),
        )
    finally:
        connection.close()

    return EvidenceImageCommandPublishResult(
        published=True,
        exchange=exchange,
        routing_key=routing_key,
        payload=payload,
    )


def _build_evidence_upload_url(upload_path):
    base_url = str(getattr(settings, "EVIDENCE_IMAGE_UPLOAD_BASE_URL", "") or "").strip()
    if not base_url:
        return ""

    normalized_base_url = f"{base_url.rstrip('/')}/"
    return urljoin(normalized_base_url, upload_path.lstrip("/"))
