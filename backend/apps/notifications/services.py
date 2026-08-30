import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils.text import slugify

from apps.notifications.email_services import schedule_notification_email
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


NOTIFICATIONS_GROUP_NAME = "notifications.global"
HEALTHY_LABEL = "healthy"
REVIEW_REQUIRED_CONFIDENCE_THRESHOLD = 0.70
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
        schedule_notification_email(notification)

    return notification, created


def is_inspection_review_required_eligible(inspection):
    if inspection.processing_status != inspection.ProcessingStatus.COMPLETED:
        return False

    if inspection.status in {
        inspection.Status.REVIEWED,
        inspection.Status.CLOSED,
    }:
        return False

    confidence_score = inspection.confidence_score
    if confidence_score is None:
        return False

    return confidence_score < REVIEW_REQUIRED_CONFIDENCE_THRESHOLD


def maybe_create_review_required_notification(inspection):
    if not is_inspection_review_required_eligible(inspection):
        return None, False

    notification, created = Notification.objects.get_or_create(
        inspection=inspection,
        event_type=Notification.EventType.REVIEW_REQUIRED,
        defaults=_build_review_required_notification_defaults(inspection),
    )

    if created:
        transaction.on_commit(
            lambda notification_id=notification.id: _safe_broadcast_notification_by_id(notification_id)
        )
        schedule_dashboard_refresh_event("review.required")

    return notification, created


def schedule_dashboard_refresh_event(reason):
    transaction.on_commit(
        lambda refresh_reason=reason: _safe_broadcast_dashboard_refresh(refresh_reason)
    )


def _is_healthy_subject(disease, display_label):
    if disease is not None:
        disease_name = (disease.name or "").strip().lower()
        disease_slug = (disease.slug or "").strip().lower()
        disease_ai_label = (getattr(disease, "ai_label", "") or "").strip().lower()
        if (
            disease_ai_label == HEALTHY_LABEL
            or disease_name == HEALTHY_LABEL
            or disease_slug == HEALTHY_LABEL
        ):
            return True

    if display_label:
        return slugify(display_label).lower() == HEALTHY_LABEL

    return False


def _build_notification_defaults(*, inspection, disease, display_label):
    severity = resolve_disease_alert_severity(inspection)
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


def _build_review_required_notification_defaults(inspection):
    disease = inspection.predicted_disease
    display_label = (
        (inspection.top1_label or "").strip()
        or getattr(disease, "name", "")
        or "Manual review"
    )
    confidence_percentage = round(float(inspection.confidence_score) * 100)
    threshold_percentage = round(REVIEW_REQUIRED_CONFIDENCE_THRESHOLD * 100)
    message = (
        f"Inspection {inspection.source_message_id or inspection.id} needs manual review "
        f"because confidence is {confidence_percentage}%, below the {threshold_percentage}% threshold."
    )

    return {
        "disease": disease,
        "severity": Notification.Severity.MEDIUM,
        "title": f"Review required: {display_label}",
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
            "review_reason": "confidence_below_threshold",
            "review_threshold": REVIEW_REQUIRED_CONFIDENCE_THRESHOLD,
        },
    }


def resolve_disease_alert_severity(inspection):
    disease = getattr(inspection, "predicted_disease", None)
    risk_level = _resolve_catalog_risk_level(disease)
    if risk_level:
        return risk_level

    return _resolve_confidence_fallback_severity(inspection.confidence_score)


def _resolve_catalog_risk_level(disease):
    if disease is None:
        return ""

    try:
        risk_level = (disease.map_profile.risk_level or "").strip().lower()
    except ObjectDoesNotExist:
        return ""

    if risk_level in Notification.Severity.values:
        return risk_level

    return ""


def _resolve_confidence_fallback_severity(confidence_score):
    if confidence_score is not None and confidence_score >= 0.95:
        return Notification.Severity.CRITICAL

    if confidence_score is not None and confidence_score >= 0.85:
        return Notification.Severity.HIGH

    if confidence_score is not None and confidence_score >= 0.70:
        return Notification.Severity.MEDIUM

    if confidence_score is not None:
        return Notification.Severity.LOW

    return Notification.Severity.MEDIUM


def _broadcast_notification_by_id(notification_id):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    notification = Notification.objects.select_related("inspection", "disease").get(pk=notification_id)
    payload = _serialize_notification_for_broadcast(notification)

    _broadcast_group_event(
        channel_layer,
        event_type="notification.created",
        notification=payload,
    )


def _broadcast_dashboard_refresh(reason):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    _broadcast_group_event(
        channel_layer,
        event_type="dashboard.refresh",
        reason=reason,
    )


def _broadcast_group_event(channel_layer, *, event_type, **payload):
    async_to_sync(channel_layer.group_send)(
        NOTIFICATIONS_GROUP_NAME,
        {
            "type": event_type,
            **payload,
        },
    )


def _serialize_notification_for_broadcast(notification):
    return NotificationSerializer(notification).data


def _safe_broadcast_notification_by_id(notification_id):
    try:
        _broadcast_notification_by_id(notification_id)
    except Exception:
        logger.exception(
            "Notification websocket broadcast failed for notification_id=%s",
            notification_id,
        )


def _safe_broadcast_dashboard_refresh(reason):
    try:
        _broadcast_dashboard_refresh(reason)
    except Exception:
        logger.exception(
            "Dashboard refresh websocket broadcast failed for reason=%s",
            reason,
        )
