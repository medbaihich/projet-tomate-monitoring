from django.conf import settings
from django.db import models

from apps.catalog.models import Disease
from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel
from apps.inspections.models import Inspection


class Review(UUIDPrimaryKeyModel, TimeStampedModel):
    class Decision(models.TextChoices):
        ACCEPTED = "accepted", "Accepted"
        CORRECTED = "corrected", "Corrected"
        REJECTED = "rejected", "Rejected"

    inspection = models.OneToOneField(
        Inspection,
        on_delete=models.CASCADE,
        related_name="review",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="reviews",
        null=True,
        blank=True,
    )
    corrected_disease = models.ForeignKey(
        Disease,
        on_delete=models.SET_NULL,
        related_name="reviews",
        null=True,
        blank=True,
    )
    decision = models.CharField(max_length=20, choices=Decision.choices)
    comments = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-reviewed_at", "-created_at")

    def __str__(self) -> str:
        return f"{self.inspection_id} - {self.decision}"
