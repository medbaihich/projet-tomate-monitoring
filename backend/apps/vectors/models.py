from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel
from apps.inference.models import ModelVersion
from apps.inspections.models import Inspection


class EmbeddingRecord(UUIDPrimaryKeyModel, TimeStampedModel):
    model_version = models.ForeignKey(
        ModelVersion,
        on_delete=models.PROTECT,
        related_name="embedding_records",
    )
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.SET_NULL,
        related_name="embedding_records",
        null=True,
        blank=True,
    )
    label = models.CharField(max_length=255, blank=True)
    vector = models.JSONField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        if self.inspection_id:
            return f"{self.model_version} - inspection {self.inspection_id}"

        return f"{self.model_version} - standalone embedding"
