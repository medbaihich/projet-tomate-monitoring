from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import Disease
from apps.inspections.models import Inspection
from apps.review.models import Review


def create_review(*, review_data, default_reviewer=None):
    inspection = _get_required_instance(
        Inspection,
        review_data.get("inspection"),
        "inspection",
    )
    reviewer = _get_optional_instance(
        User,
        review_data.get("reviewer") or default_reviewer,
        "reviewer",
    )
    corrected_disease = _get_optional_instance(
        Disease,
        review_data.get("corrected_disease"),
        "corrected_disease",
    )

    review = Review.objects.create(
        inspection=inspection,
        reviewer=reviewer,
        corrected_disease=corrected_disease,
        decision=review_data["decision"],
        comments=review_data.get("comments", ""),
        reviewed_at=review_data.get("reviewed_at") or timezone.now(),
    )

    return (
        Review.objects.select_related(
            "inspection",
            "reviewer",
            "corrected_disease",
        ).get(pk=review.pk)
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


def _get_optional_instance(model_class, value, field_name):
    if value is None:
        return None

    if isinstance(value, model_class):
        if not model_class.objects.filter(pk=value.pk).exists():
            raise ValidationError({field_name: "Referenced object does not exist."})
        return value

    try:
        return model_class.objects.get(pk=value)
    except model_class.DoesNotExist as exc:
        raise ValidationError({field_name: "Referenced object does not exist."}) from exc
