from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class ModelVersion(UUIDPrimaryKeyModel, TimeStampedModel):
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=100)
    framework = models.CharField(max_length=100, blank=True)
    artifact_path = models.CharField(max_length=500, blank=True)
    checksum = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("name", "version")
        constraints = [
            models.UniqueConstraint(
                fields=("name", "version"),
                name="unique_model_version_per_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} {self.version}"


class InferenceIndex(UUIDPrimaryKeyModel, TimeStampedModel):
    class OrganType(models.TextChoices):
        LEAF = "leaf", "Leaf"
        FRUIT = "fruit", "Fruit"

    model_version = models.ForeignKey(
        ModelVersion,
        on_delete=models.CASCADE,
        related_name="indexes",
    )
    name = models.CharField(max_length=255)
    organ_type = models.CharField(
        max_length=20,
        choices=OrganType.choices,
        default=OrganType.LEAF,
    )
    index_path = models.CharField(max_length=500, blank=True)
    metadata_path = models.CharField(max_length=500, blank=True)
    threshold_default = models.FloatField(default=0.8)
    top_k_default = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    loaded_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("model_version", "organ_type", "name"),
                name="unique_index_name_per_model_version_and_organ",
            )
        ]

    def __str__(self) -> str:
        return f"{self.model_version} - {self.organ_type} - {self.name}"
