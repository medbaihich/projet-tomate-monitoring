import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils.text import slugify

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


NOTIFICATIONS_GROUP_NAME = "notifications.global"
HEALTHY_LABEL = "healthy"
logger = logging.getLogger(__name__)


def is_inspection_alert_eligible(inspection):
    if inspection.processing_status != inspection.ProcessingStatus.COMPLETED:
        return False

    disease, display_label = resolve_alert_subject(inspection)

    if disease is None and not display_label:
        return False

    return not _is_healthy_subject(disease, display_label)


def resolve_alert_subject(inspection):
    disease = inspection.predicted_disease
    display_label = (inspection.top1_label or "").strip()

    if disease is not None:
        display_label = display_label or disease.name

    return disease, display_label


def maybe_create_disease_alert_notification(inspection):
    if not is_inspection_alert_eligible(inspection):
        return None, False

    disease, display_label = resolve_alert_subject(inspection)
    notification_defaults = _build_notification_defaults(
        inspection=inspection,
        disease=disease,
        display_label=display_label,
    )

    notification, created = Notification.objects.get_or_create(
        inspection=inspection,
        event_type=Notification.EventType.DISEASE_ALERT,
        defaults=notification_defaults,
    )

    if created:
        transaction.on_commit(
            lambda notification_id=notification.id: _safe_broadcast_notification_by_id(notification_id)
        )

    return notification, created


def _is_healthy_subject(disease, display_label):
    if disease is not None:
        disease_name = (disease.name or "").strip().lower()
        disease_slug = (disease.slug or "").strip().lower()
        if disease_name == HEALTHY_LABEL or disease_slug == HEALTHY_LABEL:
            return True

    if display_label:
        return slugify(display_label).lower() == HEALTHY_LABEL

    return False


def _build_notification_defaults(*, inspection, disease, display_label):
    severity = _resolve_severity(inspection.confidence_score)
    title = f"Disease alert detected: {display_label}"
    message = (
        f"Inspection {inspection.source_message_id or inspection.id} detected {display_label} "
        f"for device {inspection.device.name}."
    )

    return {
        "disease": disease,
        "severity": severity,
        "title": title,
        "message": message,
        "display_disease_label": display_label,
        "confidence_score": inspection.confidence_score,
        "payload": {
            "device_id": str(inspection.device_id),
            "device_name": inspection.device.name,
            "device_identifier": inspection.device.identifier,
            "inspection_status": inspection.status,
            "processing_status": inspection.processing_status,
            "organ_type": inspection.organ_type,
            "source_message_id": inspection.source_message_id,
            "captured_at": inspection.captured_at.isoformat() if inspection.captured_at else None,
            "received_at": inspection.received_at.isoformat() if inspection.received_at else None,
        },
    }


def _resolve_severity(confidence_score):
    if confidence_score is not None and confidence_score >= 0.85:
        return Notification.Severity.HIGH

    return Notification.Severity.MEDIUM


def _broadcast_notification_by_id(notification_id):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    notification = Notification.objects.select_related("inspection", "disease").get(pk=notification_id)
    payload = NotificationSerializer(notification).data

    async_to_sync(channel_layer.group_send)(
        NOTIFICATIONS_GROUP_NAME,
        {
            "type": "notification.created",
            "notification": payload,
        },
    )


def _safe_broadcast_notification_by_id(notification_id):
    try:
        _broadcast_notification_by_id(notification_id)
    except Exception:
        logger.exception(
            "Notification websocket broadcast failed for notification_id=%s",
            notification_id,
        )
