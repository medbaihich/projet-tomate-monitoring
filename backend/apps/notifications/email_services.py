import logging
import re
from html import escape
from string import capwords

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone

from apps.inspections.models import Inspection
from apps.notifications.models import Notification


logger = logging.getLogger(__name__)

SEVERITY_PRESENTATION = {
    Notification.Severity.CRITICAL: {
        "color": "#7e22ce",
        "label": "CRITICAL",
        "message": (
            "Intervention immédiate requise. Une alerte critique a été détectée. "
            "Veuillez consulter rapidement la plateforme, vérifier la maladie détectée "
            "et vous diriger vers la serre concernée."
        ),
    },
    Notification.Severity.HIGH: {
        "color": "#dc2626",
        "label": "HIGH",
        "message": (
            "Alerte élevée détectée. Une vérification rapide est recommandée afin "
            "de confirmer le diagnostic et d’éviter une propagation potentielle."
        ),
    },
    Notification.Severity.MEDIUM: {
        "color": "#ea580c",
        "label": "MEDIUM",
        "message": (
            "Alerte moyenne détectée. Merci de consulter l’inspection et de planifier "
            "une vérification terrain si nécessaire."
        ),
    },
    Notification.Severity.LOW: {
        "color": "#ca8a04",
        "label": "LOW",
        "message": (
            "Alerte faible détectée. Une surveillance est recommandée. Veuillez consulter "
            "les détails dans la plateforme."
        ),
    },
}
FALLBACK_PRESENTATION = {
    "color": "#6b7280",
    "label": "ALERT",
    "message": (
        "Une alerte maladie a été détectée. Veuillez consulter la plateforme pour plus de détails."
    ),
}
REVIEW_REQUIRED_MESSAGE = (
    "Une inspection nécessite une revue humaine. Merci de vérifier le résultat proposé "
    "par le système et de confirmer ou corriger le diagnostic dans la page Review."
)


def schedule_notification_email(notification):
    transaction.on_commit(
        lambda notification_id=notification.id: _safe_send_disease_alert_email(notification_id)
    )


def schedule_review_required_email(inspection):
    if not _inspection_requires_review(inspection):
        return

    transaction.on_commit(
        lambda inspection_id=inspection.id: _safe_send_review_required_email(inspection_id)
    )


def _safe_send_disease_alert_email(notification_id):
    try:
        _send_disease_alert_email_by_id(notification_id)
    except Exception:
        logger.exception(
            "Disease alert email notification failed for notification_id=%s.",
            notification_id,
        )


def _safe_send_review_required_email(inspection_id):
    try:
        _send_review_required_email_by_id(inspection_id)
    except Exception:
        logger.exception(
            "Review-required email notification failed for inspection_id=%s.",
            inspection_id,
        )


def _send_disease_alert_email_by_id(notification_id):
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", False):
        logger.info(
            "Skipping disease alert email for notification_id=%s because email notifications are disabled.",
            notification_id,
        )
        return

    recipients = _normalize_recipients(getattr(settings, "ALERT_EMAIL_RECIPIENTS", []))
    if not recipients:
        logger.info(
            "Skipping disease alert email for notification_id=%s because no alert recipients are configured.",
            notification_id,
        )
        return

    notification = (
        Notification.objects.select_related(
            "disease",
            "inspection__predicted_disease",
            "inspection__device__line__zone__greenhouse__site",
        )
        .filter(pk=notification_id)
        .first()
    )
    if notification is None:
        logger.info(
            "Skipping disease alert email because notification_id=%s no longer exists.",
            notification_id,
        )
        return

    inspection = notification.inspection
    context = _build_inspection_context(
        inspection,
        disease_label=notification.display_disease_label,
    )
    presentation = SEVERITY_PRESENTATION.get(notification.severity, FALLBACK_PRESENTATION)
    subject = (
        f"[SMART EYE][{presentation['label']}] "
        f"Alerte maladie tomate - {context['disease_label']}"
    )
    text_body = _build_disease_alert_text_body(
        context=context,
        notification=notification,
        presentation=presentation,
    )
    html_body = _build_disease_alert_html_body(
        context=context,
        notification=notification,
        presentation=presentation,
    )
    _deliver_email_message(
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        recipients=recipients,
    )


def _send_review_required_email_by_id(inspection_id):
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", False):
        logger.info(
            "Skipping review-required email for inspection_id=%s because email notifications are disabled.",
            inspection_id,
        )
        return

    recipients = _normalize_recipients(getattr(settings, "REVIEW_EMAIL_RECIPIENTS", []))
    if not recipients:
        logger.info(
            "Skipping review-required email for inspection_id=%s because no review recipients are configured.",
            inspection_id,
        )
        return

    inspection = (
        Inspection.objects.select_related(
            "predicted_disease",
            "device__line__zone__greenhouse__site",
        )
        .filter(pk=inspection_id)
        .first()
    )
    if inspection is None:
        logger.info(
            "Skipping review-required email because inspection_id=%s no longer exists.",
            inspection_id,
        )
        return

    if not _inspection_requires_review(inspection):
        logger.info(
            "Skipping review-required email for inspection_id=%s because the inspection is no longer reviewable.",
            inspection_id,
        )
        return

    context = _build_inspection_context(inspection)
    subject = "[SMART EYE][REVIEW] Inspection en attente de revue"
    text_body = _build_review_required_text_body(context)
    html_body = _build_review_required_html_body(context)
    _deliver_email_message(
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        recipients=recipients,
    )


def _deliver_email_message(*, subject, text_body, html_body, recipients):
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipients,
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def _build_inspection_context(inspection, disease_label=""):
    device = inspection.device
    line = getattr(device, "line", None)
    zone = getattr(line, "zone", None)
    greenhouse = getattr(zone, "greenhouse", None)
    site = getattr(greenhouse, "site", None)
    predicted_disease = getattr(inspection, "predicted_disease", None)

    resolved_disease_label = (
        disease_label
        or getattr(predicted_disease, "name", "")
        or inspection.top1_label
    )
    return {
        "inspection_id": str(inspection.id),
        "source_message_id": inspection.source_message_id or "N/A",
        "disease_label": _humanize_label(resolved_disease_label or "Maladie non précisée"),
        "device_name": (device.name or "").strip(),
        "device_identifier": (device.identifier or "").strip() or "N/A",
        "device_label": _build_device_label(device),
        "site_name": getattr(site, "name", "") or "N/A",
        "greenhouse_name": getattr(greenhouse, "name", "") or "N/A",
        "zone_name": getattr(zone, "name", "") or "N/A",
        "line_name": getattr(line, "name", "") or "N/A",
        "organ_type": _humanize_label(inspection.organ_type or "unknown"),
        "predicted_label": _humanize_label(
            getattr(predicted_disease, "name", "") or inspection.top1_label or "N/A"
        ),
        "confidence_score": _format_confidence_score(inspection.confidence_score),
        "captured_at": _format_datetime(inspection.captured_at),
        "inspection_link": _build_frontend_url("/inspections"),
        "review_link": _build_frontend_url("/review"),
    }


def _build_disease_alert_text_body(*, context, notification, presentation):
    return "\n".join(
        [
            f"Alerte maladie Smart Eye - {presentation['label']}",
            "",
            presentation["message"],
            "",
            f"Maladie détectée : {context['disease_label']}",
            f"Sévérité : {presentation['label']}",
            f"Confiance : {context['confidence_score']}",
            f"Inspection ID : {context['inspection_id']}",
            f"Source message ID : {context['source_message_id']}",
            f"Appareil : {context['device_label']}",
            f"Site : {context['site_name']}",
            f"Serre : {context['greenhouse_name']}",
            f"Zone : {context['zone_name']}",
            f"Ligne : {context['line_name']}",
            f"Capturée le : {context['captured_at']}",
            "",
            f"Message plateforme : {notification.message}",
            f"Lien inspections : {context['inspection_link']}",
            f"Lien review : {context['review_link']}",
        ]
    )


def _build_disease_alert_html_body(*, context, notification, presentation):
    rows = [
        ("Maladie détectée", context["disease_label"]),
        ("Sévérité", presentation["label"]),
        ("Confiance", context["confidence_score"]),
        ("Inspection ID", context["inspection_id"]),
        ("Source message ID", context["source_message_id"]),
        ("Appareil", context["device_label"]),
        ("Site", context["site_name"]),
        ("Serre", context["greenhouse_name"]),
        ("Zone", context["zone_name"]),
        ("Ligne", context["line_name"]),
        ("Capturée le", context["captured_at"]),
    ]
    rows_html = "".join(
        (
            "<tr>"
            f"<td style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;\">{escape(label)}</td>"
            f"<td style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;\">{escape(value)}</td>"
            "</tr>"
        )
        for label, value in rows
    )
    return (
        "<html><body style=\"margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;\">"
        "<div style=\"max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;\">"
        f"<div style=\"padding:20px 24px;background:{presentation['color']};color:#ffffff;\">"
        f"<div style=\"font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.92;\">SMART EYE</div>"
        f"<h1 style=\"margin:8px 0 0;font-size:26px;\">Alerte maladie tomate</h1>"
        f"<p style=\"margin:10px 0 0;font-size:15px;line-height:1.6;\">{escape(presentation['message'])}</p>"
        "</div>"
        "<div style=\"padding:24px;\">"
        f"<p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;\">{escape(notification.message)}</p>"
        "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">"
        f"{rows_html}"
        "</table>"
        "<div style=\"margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;\">"
        f"<a href=\"{escape(context['inspection_link'])}\" style=\"display:inline-block;padding:12px 18px;border-radius:999px;background:{presentation['color']};color:#ffffff;text-decoration:none;font-weight:700;\">Ouvrir Inspections</a>"
        f"<a href=\"{escape(context['review_link'])}\" style=\"display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;\">Ouvrir Review</a>"
        "</div>"
        "</div>"
        "</div>"
        "</body></html>"
    )


def _build_review_required_text_body(context):
    return "\n".join(
        [
            "Inspection en attente de revue",
            "",
            REVIEW_REQUIRED_MESSAGE,
            "",
            f"Inspection ID : {context['inspection_id']}",
            f"Appareil : {context['device_label']}",
            f"Type d'organe : {context['organ_type']}",
            f"Prédiction proposée : {context['predicted_label']}",
            f"Confiance : {context['confidence_score']}",
            f"Capturée le : {context['captured_at']}",
            f"Lien review : {context['review_link']}",
        ]
    )


def _build_review_required_html_body(context):
    rows = [
        ("Inspection ID", context["inspection_id"]),
        ("Appareil", context["device_label"]),
        ("Type d'organe", context["organ_type"]),
        ("Prédiction proposée", context["predicted_label"]),
        ("Confiance", context["confidence_score"]),
        ("Capturée le", context["captured_at"]),
    ]
    rows_html = "".join(
        (
            "<tr>"
            f"<td style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;\">{escape(label)}</td>"
            f"<td style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;\">{escape(value)}</td>"
            "</tr>"
        )
        for label, value in rows
    )
    return (
        "<html><body style=\"margin:0;padding:24px;background:#fff7ed;font-family:Arial,sans-serif;color:#0f172a;\">"
        "<div style=\"max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #fed7aa;border-radius:16px;overflow:hidden;\">"
        "<div style=\"padding:20px 24px;background:#f59e0b;color:#1f2937;\">"
        "<div style=\"font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.92;\">SMART EYE</div>"
        "<h1 style=\"margin:8px 0 0;font-size:26px;\">Inspection en attente de revue</h1>"
        f"<p style=\"margin:10px 0 0;font-size:15px;line-height:1.6;\">{escape(REVIEW_REQUIRED_MESSAGE)}</p>"
        "</div>"
        "<div style=\"padding:24px;\">"
        "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">"
        f"{rows_html}"
        "</table>"
        "<div style=\"margin-top:24px;\">"
        f"<a href=\"{escape(context['review_link'])}\" style=\"display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;\">Ouvrir Review</a>"
        "</div>"
        "</div>"
        "</div>"
        "</body></html>"
    )


def _inspection_requires_review(inspection):
    ai_result_metadata = ((inspection.extra_metadata or {}).get("ai_result") or {})
    return bool(ai_result_metadata.get("requires_review", False))


def _build_device_label(device):
    name = (device.name or "").strip()
    identifier = (device.identifier or "").strip()
    if name and identifier:
        return f"{name} ({identifier})"
    return name or identifier or "N/A"


def _build_frontend_url(path):
    base_url = (getattr(settings, "FRONTEND_BASE_URL", "") or "").strip().rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base_url}{path}" if base_url else path


def _format_datetime(value):
    if value is None:
        return "N/A"

    current_value = value
    if timezone.is_aware(current_value):
        current_value = timezone.localtime(current_value)
    return current_value.strftime("%Y-%m-%d %H:%M:%S %Z").strip()


def _format_confidence_score(value):
    if value is None:
        return "N/A"
    return f"{round(float(value) * 100)}%"


def _humanize_label(value):
    normalized_value = re.sub(r"[_-]+", " ", str(value or "").strip())
    normalized_value = re.sub(r"\s+", " ", normalized_value).strip()
    if not normalized_value:
        return "N/A"
    return capwords(normalized_value)


def _normalize_recipients(value):
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return [str(item).strip() for item in value if str(item).strip()]
