from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import slugify

from apps.catalog.models import Disease
from apps.devices.models import Device
from apps.inference.models import InferenceIndex
from apps.inspections.models import Inspection, InspectionMatch


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

    return (
        Inspection.objects.select_related(
            "device",
            "inference_index",
            "predicted_disease",
        )
        .prefetch_related("matches__disease")
        .get(pk=inspection.pk)
    )


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


def _resolve_disease_reference(disease, label):
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

    return Disease.objects.filter(name__iexact=label).first() or Disease.objects.filter(
        slug=slugify(label)
    ).first()


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
