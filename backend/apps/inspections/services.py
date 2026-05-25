import hashlib
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.catalog.models import Disease, normalize_ai_label
from apps.devices.models import Device
from apps.inference.models import InferenceIndex
from apps.inspections.models import (
    EvidenceImageRequest,
    Inspection,
    InspectionEvidenceImage,
    InspectionMatch,
)
from apps.notifications.services import (
    is_inspection_alert_eligible,
    maybe_create_disease_alert_notification,
    schedule_dashboard_refresh_event,
)


@dataclass(frozen=True, slots=True)
class AIResultIngestionOutcome:
    inspection: Inspection
    created: bool
    duplicate: bool


@dataclass(frozen=True, slots=True)
class EvidenceImageRequestOutcome:
    evidence_request: EvidenceImageRequest | None
    created: bool


@dataclass(frozen=True, slots=True)
class EvidenceImageUploadOutcome:
    evidence_request: EvidenceImageRequest
    evidence_image: InspectionEvidenceImage
    uploaded: bool
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

        schedule_dashboard_refresh_event("inspection.created")

    inspection = (
        Inspection.objects.select_related(
            "device",
            "inference_index",
            "predicted_disease",
            "evidence_request",
            "evidence_image",
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

    maybe_create_evidence_image_request_for_inspection(inspection)

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


def maybe_create_evidence_image_request_for_inspection(inspection):
    reason = _resolve_evidence_request_reason(inspection)
    if not reason:
        return EvidenceImageRequestOutcome(evidence_request=None, created=False)

    image_id = _extract_evidence_image_id(inspection)
    local_image_ref = _extract_local_image_ref(inspection)
    request_defaults = {
        "device": inspection.device,
        "source_message_id": inspection.source_message_id,
        "image_id": image_id,
        "local_image_ref": local_image_ref,
        "reason": reason,
        "status": EvidenceImageRequest.Status.PENDING,
        "requested_at": timezone.now(),
        # Review-required takes priority when both conditions apply because
        # visual evidence is most critical for human verification workflows.
        "request_payload": {
            "source_message_id": inspection.source_message_id,
            "device_identifier": inspection.device.identifier,
            "image_id": image_id,
            "local_image_ref": local_image_ref,
            "reason": reason,
        },
    }

    evidence_request, created = EvidenceImageRequest.objects.get_or_create(
        inspection=inspection,
        defaults=request_defaults,
    )
    return EvidenceImageRequestOutcome(
        evidence_request=evidence_request,
        created=created,
    )


def store_evidence_image_upload(
    *,
    request_id,
    source_message_id,
    device_identifier,
    image_file,
    client_image_sha256="",
):
    evidence_request = (
        EvidenceImageRequest.objects.select_related(
            "inspection",
            "device",
        )
        .filter(pk=request_id)
        .first()
    )
    if evidence_request is None:
        raise ValidationError({"request_id": "Evidence image request does not exist."})

    if source_message_id != evidence_request.source_message_id:
        raise ValidationError(
            {"source_message_id": "Source message ID does not match the evidence image request."}
        )

    if device_identifier != evidence_request.device.identifier:
        raise ValidationError(
            {"device_identifier": "Device identifier does not match the evidence image request."}
        )

    max_size_bytes = getattr(settings, "EVIDENCE_IMAGE_UPLOAD_MAX_BYTES", 0)
    if max_size_bytes and image_file.size > max_size_bytes:
        raise ValidationError(
            {"image": f"Uploaded file exceeds the maximum size of {max_size_bytes} bytes."}
        )

    computed_sha256 = _compute_sha256_for_uploaded_file(image_file)
    if client_image_sha256 and client_image_sha256 != computed_sha256:
        raise ValidationError(
            {"image_sha256": "Provided image checksum does not match the uploaded file."}
        )

    existing_image = _get_optional_related(evidence_request, "evidence_image")
    if existing_image is not None:
        if existing_image.image_sha256 != computed_sha256:
            raise ValidationError(
                {
                    "image": (
                        "Uploaded file does not match the evidence image already stored for this request."
                    )
                }
            )

        if evidence_request.status != EvidenceImageRequest.Status.UPLOADED or evidence_request.uploaded_at is None:
            uploaded_at = existing_image.uploaded_at or timezone.now()
            EvidenceImageRequest.objects.filter(pk=evidence_request.pk).update(
                status=EvidenceImageRequest.Status.UPLOADED,
                uploaded_at=uploaded_at,
                failure_reason="",
                response_metadata=_build_evidence_response_metadata(
                    image=existing_image,
                    image_sha256=computed_sha256,
                ),
            )
            evidence_request.refresh_from_db()

        return EvidenceImageUploadOutcome(
            evidence_request=evidence_request,
            evidence_image=existing_image,
            uploaded=True,
            duplicate=True,
        )

    if evidence_request.status != EvidenceImageRequest.Status.PENDING:
        raise ValidationError(
            {
                "request_id": (
                    f"Evidence image request is not pending. Current status is '{evidence_request.status}'."
                )
            }
        )

    original_filename = Path(getattr(image_file, "name", "")).name or "evidence-upload.bin"
    uploaded_at = timezone.now()
    image_file.seek(0)

    with transaction.atomic():
        evidence_image = InspectionEvidenceImage.objects.create(
            inspection=evidence_request.inspection,
            request=evidence_request,
            device=evidence_request.device,
            source_message_id=evidence_request.source_message_id,
            image=image_file,
            original_filename=original_filename,
            mime_type=getattr(image_file, "content_type", "") or "",
            size_bytes=image_file.size,
            image_sha256=computed_sha256,
            uploaded_at=uploaded_at,
            metadata={
                "request_reason": evidence_request.reason,
            },
        )
        EvidenceImageRequest.objects.filter(pk=evidence_request.pk).update(
            status=EvidenceImageRequest.Status.UPLOADED,
            uploaded_at=uploaded_at,
            failure_reason="",
            response_metadata=_build_evidence_response_metadata(
                image=evidence_image,
                image_sha256=computed_sha256,
            ),
        )

    evidence_request.refresh_from_db()
    evidence_image.refresh_from_db()
    return EvidenceImageUploadOutcome(
        evidence_request=evidence_request,
        evidence_image=evidence_image,
        uploaded=True,
        duplicate=False,
    )


def _resolve_evidence_request_reason(inspection):
    ai_result_metadata = ((inspection.extra_metadata or {}).get("ai_result") or {})
    if bool(ai_result_metadata.get("requires_review", False)):
        return EvidenceImageRequest.Reason.REVIEW_REQUIRED

    if is_inspection_alert_eligible(inspection):
        return EvidenceImageRequest.Reason.DISEASE_ALERT

    return ""


def _extract_evidence_image_id(inspection):
    worker_extra_metadata = ((inspection.extra_metadata or {}).get("worker_extra_metadata") or {})
    capture_artifact = worker_extra_metadata.get("capture_artifact") or {}
    return (
        str(worker_extra_metadata.get("image_id", "")).strip()
        or str(capture_artifact.get("image_id", "")).strip()
    )


def _extract_local_image_ref(inspection):
    worker_extra_metadata = ((inspection.extra_metadata or {}).get("worker_extra_metadata") or {})
    capture_artifact = worker_extra_metadata.get("capture_artifact") or {}
    return str(capture_artifact.get("local_image_ref", "")).strip()


def _compute_sha256_for_uploaded_file(image_file):
    hasher = hashlib.sha256()
    image_file.seek(0)
    for chunk in image_file.chunks():
        hasher.update(chunk)
    image_file.seek(0)
    return hasher.hexdigest()


def _build_evidence_response_metadata(*, image, image_sha256):
    return {
        "evidence_image_id": str(image.id),
        "image_sha256": image_sha256,
        "original_filename": image.original_filename,
        "mime_type": image.mime_type,
        "size_bytes": image.size_bytes,
    }


def _get_optional_related(instance, related_name):
    try:
        return getattr(instance, related_name)
    except ObjectDoesNotExist:
        return None
