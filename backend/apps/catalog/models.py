from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class Disease(UUIDPrimaryKeyModel, TimeStampedModel):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    summary = models.TextField(blank=True)
    symptoms = models.TextField(blank=True)
    prevention = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class DiseaseCause(UUIDPrimaryKeyModel, TimeStampedModel):
    disease = models.ForeignKey(
        Disease,
        on_delete=models.CASCADE,
        related_name="causes",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("title",)

    def __str__(self) -> str:
        return f"{self.disease.name} - {self.title}"


class DiseaseTreatment(UUIDPrimaryKeyModel, TimeStampedModel):
    disease = models.ForeignKey(
        Disease,
        on_delete=models.CASCADE,
        related_name="treatments",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("title",)

    def __str__(self) -> str:
        return f"{self.disease.name} - {self.title}"


class DiseaseResource(UUIDPrimaryKeyModel, TimeStampedModel):
    disease = models.ForeignKey(
        Disease,
        on_delete=models.CASCADE,
        related_name="resources",
    )
    title = models.CharField(max_length=255)
    url = models.URLField()
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("title",)

    def __str__(self) -> str:
        return f"{self.disease.name} - {self.title}"
