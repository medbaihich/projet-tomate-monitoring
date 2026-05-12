from dataclasses import dataclass
from pathlib import Path

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils.text import slugify

from apps.catalog.models import Disease, normalize_ai_label
from apps.devices.models import Device
from apps.inference.models import InferenceIndex
from apps.inspections.models import Inspection, InspectionMatch
from apps.notifications.services import maybe_create_disease_alert_notification


@dataclass(frozen=True, slots=True)
class AIResultIngestionOutcome:
    inspection: Inspection
    created: bool
    duplicate: bool


def create_inspection_with_matches(*, inspection_data, matches_data=None):
    matches_data = matches_data or []

    device = _get_required_instance(Device, inspection_data.get("device"), "device")
    inference_index = _get_required_instance(
        InferenceIndex,
        inspection_data.get("inference_index"),
        "inference_index",
    )
    predicted_disease = _resolve_disease_reference(
        inspection_data.get("predicted_disease"),
        inspection_data.get("top1_label"),
        inspection_data.get("organ_type"),
    )

    inspection_values = {
        **inspection_data,
        "device": device,
        "inference_index": inference_index,
        "predicted_disease": predicted_disease,
    }

    if inference_index.organ_type != inspection_values["organ_type"]:
        raise ValidationError(
            {
                "inference_index": (
                    "The selected inference index organ type must match the inspection organ type."
                )
            }
        )

    normalized_matches = _normalize_match_data(matches_data)

    with transaction.atomic():
        inspection = Inspection.objects.create(**inspection_values)
        match_instances = [
            InspectionMatch(
                inspection=inspection,
                disease=_resolve_disease_reference(
                    match_data.get("disease"),
                    match_data.get("matched_label"),
                    inspection_values["organ_type"],
                ),
                rank_order=match_data["rank_order"],
                matched_label=match_data["matched_label"],
                similarity_score=match_data["similarity_score"],
                metadata_json=match_data.get("metadata_json", {}),
            )
            for match_data in normalized_matches
        ]

        if match_instances:
            InspectionMatch.objects.bulk_create(match_instances)

    inspection = (
        Inspection.objects.select_related(
            "device",
            "inference_index",
            "predicted_disease",
        )
        .prefetch_related("matches__disease")
        .get(pk=inspection.pk)
    )

    maybe_create_disease_alert_notification(inspection)

    return inspection


def _get_required_instance(model_class, value, field_name):
    if value is None:
        raise ValidationError({field_name: "This field is required."})

    if isinstance(value, model_class):
        if not model_class.objects.filter(pk=value.pk).exists():
            raise ValidationError({field_name: "Referenced object does not exist."})
        return value

    try:
        return model_class.objects.get(pk=value)
    except model_class.DoesNotExist as exc:
        raise ValidationError({field_name: "Referenced object does not exist."}) from exc


def _resolve_disease_reference(disease, label, organ_type=None):
    if isinstance(disease, Disease):
        return disease

    if disease is not None:
        try:
            return Disease.objects.get(pk=disease)
        except Disease.DoesNotExist as exc:
            raise ValidationError({"disease": "Referenced disease does not exist."}) from exc

    if not label:
        return None

    label = label.strip()
    if not label:
        return None

    normalized_label = normalize_ai_label(label)
    if organ_type and normalized_label:
        disease = Disease.objects.filter(
            organ_type=organ_type,
            ai_label=normalized_label,
        ).first()
        if disease is not None:
            return disease

    fallback_queryset = Disease.objects.all()
    if organ_type:
        fallback_queryset = fallback_queryset.filter(organ_type=organ_type)

    return (
        fallback_queryset.filter(name__iexact=label).first()
        or fallback_queryset.filter(ai_label=normalized_label).first()
        or fallback_queryset.filter(slug=slugify(label)).first()
    )


def _normalize_match_data(matches_data):
    normalized = []
    seen_ranks = set()

    for index, match_data in enumerate(matches_data, start=1):
        rank_order = match_data.get("rank_order") or index
        if rank_order in seen_ranks:
            raise ValidationError(
                {"matches": f"Duplicate match rank_order '{rank_order}' is not allowed."}
            )

        seen_ranks.add(rank_order)
        normalized.append(
            {
                **match_data,
                "rank_order": rank_order,
                "metadata_json": match_data.get("metadata_json") or {},
            }
        )

    return normalized


def ingest_ai_result_payload(*, ai_result_data):
    source_message_id = ai_result_data["source_message_id"]
    existing_inspection = _get_existing_inspection_by_source_message_id(source_message_id)
    if existing_inspection is not None:
        return AIResultIngestionOutcome(
            inspection=existing_inspection,
            created=False,
            duplicate=True,
        )

    device = _resolve_device_by_identifier(ai_result_data["device_identifier"])
    organ_type = ai_result_data["organ_type"]
    inference_index = _resolve_inference_index_for_ai_result(
        organ_type=organ_type,
        index_used=ai_result_data.get("index_used", ""),
        metadata_used=ai_result_data.get("metadata_used", ""),
    )

    inspection_data = {
        "device": device,
        "inference_index": inference_index,
        "organ_type": organ_type,
        "status": Inspection.Status.NEW,
        "processing_status": Inspection.ProcessingStatus.COMPLETED,
        "source_message_id": source_message_id,
        "top1_label": _resolve_ai_result_label(ai_result_data),
        "confidence_score": ai_result_data.get("confidence_score"),
        "captured_at": ai_result_data["captured_at"],
        "received_at": ai_result_data["received_at"],
        "processed_at": ai_result_data["processed_at"],
        "extra_metadata": _build_ai_result_extra_metadata(ai_result_data),
    }
    matches_data = ai_result_data.get("matches", [])

    try:
        inspection = create_inspection_with_matches(
            inspection_data=inspection_data,
            matches_data=matches_data,
        )
    except IntegrityError as exc:
        duplicate_inspection = _get_existing_inspection_by_source_message_id(source_message_id)
        if duplicate_inspection is not None:
            return AIResultIngestionOutcome(
                inspection=duplicate_inspection,
                created=False,
                duplicate=True,
            )
        raise exc

    return AIResultIngestionOutcome(
        inspection=inspection,
        created=True,
        duplicate=False,
    )


def _get_existing_inspection_by_source_message_id(source_message_id):
    if not source_message_id:
        return None

    return (
        Inspection.objects.select_related(
            "device",
            "inference_index",
            "predicted_disease",
        )
        .prefetch_related("matches__disease")
        .filter(source_message_id=source_message_id)
        .first()
    )


def _resolve_device_by_identifier(device_identifier):
    device = Device.objects.filter(identifier=device_identifier).first()
    if device is None:
        raise ValidationError(
            {
                "device_identifier": (
                    f"Device with identifier '{device_identifier}' does not exist."
                )
            }
        )
    return device


def _resolve_inference_index_for_ai_result(*, organ_type, index_used, metadata_used):
    queryset = InferenceIndex.objects.filter(organ_type=organ_type)
    active_queryset = queryset.filter(is_active=True)
    candidates = list(active_queryset) or list(queryset)

    if not candidates:
        raise ValidationError(
            {
                "organ_type": (
                    f"No inference index is configured for organ_type '{organ_type}'."
                )
            }
        )

    normalized_index_used = _normalize_optional_name(index_used)
    normalized_metadata_used = _normalize_optional_name(metadata_used)

    for candidate in candidates:
        candidate_name = candidate.name.strip().lower()
        candidate_index_basename = Path(candidate.index_path or "").name.strip().lower()
        candidate_metadata_basename = Path(candidate.metadata_path or "").name.strip().lower()

        if normalized_index_used and normalized_index_used in {
            candidate_name,
            candidate_index_basename,
        }:
            return candidate

        if normalized_metadata_used and normalized_metadata_used == candidate_metadata_basename:
            return candidate

    return candidates[0]


def _normalize_optional_name(value):
    if not value:
        return ""
    return str(value).strip().lower()


def _resolve_ai_result_label(ai_result_data):
    for key in ("final_label", "top1_label"):
        value = (ai_result_data.get(key) or "").strip()
        if value:
            return value

    matches = ai_result_data.get("matches", [])
    if matches:
        return str(matches[0].get("matched_label", "")).strip()

    return ""


def _build_ai_result_extra_metadata(ai_result_data):
    worker_extra_metadata = ai_result_data.get("extra_metadata") or {}
    return {
        "ai_result": {
            "schema_version": ai_result_data["schema_version"],
            "message_type": ai_result_data["message_type"],
            "source_schema_version": ai_result_data.get("source_schema_version", ""),
            "feature_model": ai_result_data["feature_model"],
            "feature_dim": ai_result_data["feature_dim"],
            "l2_normalized": ai_result_data["l2_normalized"],
            "declared_vector_norm": ai_result_data.get("declared_vector_norm"),
            "input_vector_norm": ai_result_data.get("input_vector_norm"),
            "normalized_vector_norm": ai_result_data.get("normalized_vector_norm"),
            "organ_confidence": ai_result_data.get("organ_confidence"),
            "organ_status": ai_result_data.get("organ_status", ""),
            "top1_score": ai_result_data.get("top1_score"),
            "confidence_score_kind": ai_result_data.get("confidence_score_kind", ""),
            "majority_label": ai_result_data.get("majority_label", ""),
            "final_label": ai_result_data.get("final_label", ""),
            "index_used": ai_result_data.get("index_used", ""),
            "metadata_used": ai_result_data.get("metadata_used", ""),
            "worker_processing_status": ai_result_data.get("processing_status", ""),
            "requires_review": bool(ai_result_data.get("requires_review", False)),
            "warnings": list(ai_result_data.get("warnings", [])),
            "skip_reasons": list(ai_result_data.get("skip_reasons", [])),
        },
        "worker_extra_metadata": worker_extra_metadata,
    }
