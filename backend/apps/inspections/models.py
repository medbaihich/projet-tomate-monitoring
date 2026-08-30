from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.catalog.models import Disease
from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel
from apps.devices.models import Device
from apps.inference.models import InferenceIndex


def inspection_evidence_upload_to(instance, filename):
    device_identifier = slugify(instance.device.identifier) or str(instance.device_id)
    source_message_id = slugify(instance.source_message_id) or str(instance.inspection_id)
    safe_filename = Path(filename).name or "evidence-upload.bin"
    return f"inspection_evidence/{device_identifier}/{source_message_id}/{safe_filename}"


class Inspection(UUIDPrimaryKeyModel, TimeStampedModel):
    class OrganType(models.TextChoices):
        LEAF = "leaf", "Leaf"
        FRUIT = "fruit", "Fruit"

    class Status(models.TextChoices):
        NEW = "new", "New"
        REVIEWED = "reviewed", "Reviewed"
        CLOSED = "closed", "Closed"

    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    device = models.ForeignKey(
        Device,
        on_delete=models.PROTECT,
        related_name="inspections",
    )
    inference_index = models.ForeignKey(
        InferenceIndex,
        on_delete=models.PROTECT,
        related_name="inspections",
    )
    predicted_disease = models.ForeignKey(
        Disease,
        on_delete=models.SET_NULL,
        related_name="inspections",
        null=True,
        blank=True,
    )
    organ_type = models.CharField(max_length=20, choices=OrganType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
    )
    source_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    top1_label = models.CharField(max_length=255, blank=True)
    confidence_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
    )
    captured_at = models.DateTimeField()
    received_at = models.DateTimeField()
    processed_at = models.DateTimeField(null=True, blank=True)
    extra_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-captured_at", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("source_message_id",),
                condition=~models.Q(source_message_id=""),
                name="unique_inspection_source_message_id_when_present",
            ),
            models.CheckConstraint(
                condition=models.Q(confidence_score__isnull=True)
                | (
                    models.Q(confidence_score__gte=0)
                    & models.Q(confidence_score__lte=1)
                ),
                name="inspection_confidence_score_between_0_and_1_or_null",
            )
        ]

    def clean(self) -> None:
        super().clean()

        if (
            self.organ_type
            and self.inference_index_id
            and self.inference_index.organ_type != self.organ_type
        ):
            raise ValidationError(
                {
                    "inference_index": (
                        "The selected inference index organ type must match the inspection organ type."
                    )
                }
            )

    def __str__(self) -> str:
        return f"{self.device.name} - {self.organ_type} - {self.captured_at.isoformat()}"


class InspectionMatch(UUIDPrimaryKeyModel, TimeStampedModel):
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="matches",
    )
    disease = models.ForeignKey(
        Disease,
        on_delete=models.SET_NULL,
        related_name="inspection_matches",
        null=True,
        blank=True,
    )
    rank_order = models.PositiveIntegerField()
    matched_label = models.CharField(max_length=255)
    similarity_score = models.FloatField()
    metadata_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("rank_order",)
        constraints = [
            models.UniqueConstraint(
                fields=("inspection", "rank_order"),
                name="unique_match_rank_per_inspection",
            )
        ]

    def __str__(self) -> str:
        return f"{self.inspection_id} - rank {self.rank_order}"


class EvidenceImageRequest(UUIDPrimaryKeyModel, TimeStampedModel):
    class Reason(models.TextChoices):
        DISEASE_ALERT = "disease_alert", "Disease alert"
        REVIEW_REQUIRED = "review_required", "Review required"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        UPLOADED = "uploaded", "Uploaded"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"
        NOT_FOUND = "not_found", "Not found"

    inspection = models.OneToOneField(
        Inspection,
        on_delete=models.CASCADE,
        related_name="evidence_request",
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.PROTECT,
        related_name="evidence_image_requests",
    )
    source_message_id = models.CharField(max_length=255, db_index=True)
    image_id = models.CharField(max_length=255, blank=True)
    local_image_ref = models.CharField(max_length=255, blank=True)
    reason = models.CharField(max_length=32, choices=Reason.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    requested_at = models.DateTimeField(default=timezone.now)
    uploaded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)
    request_payload = models.JSONField(default=dict, blank=True)
    response_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-requested_at", "-created_at")
        indexes = [
            models.Index(fields=("device", "status"), name="evidence_req_device_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.source_message_id or self.inspection_id} - {self.status}"


class InspectionEvidenceImage(UUIDPrimaryKeyModel, TimeStampedModel):
    inspection = models.OneToOneField(
        Inspection,
        on_delete=models.CASCADE,
        related_name="evidence_image",
    )
    request = models.OneToOneField(
        EvidenceImageRequest,
        on_delete=models.CASCADE,
        related_name="evidence_image",
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.PROTECT,
        related_name="inspection_evidence_images",
    )
    source_message_id = models.CharField(max_length=255, db_index=True)
    image = models.FileField(
        upload_to=inspection_evidence_upload_to,
        max_length=500,
        )
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=255, blank=True)
    size_bytes = models.PositiveBigIntegerField()
    image_sha256 = models.CharField(max_length=64)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-uploaded_at", "-created_at")

    def __str__(self) -> str:
        return f"{self.source_message_id or self.inspection_id} - {self.original_filename}"
