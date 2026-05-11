import re

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


def normalize_ai_label(value):
    if value is None:
        return ""

    normalized = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower())
    return normalized.strip("_")


class Disease(UUIDPrimaryKeyModel, TimeStampedModel):
    class OrganType(models.TextChoices):
        FRUIT = "fruit", "Fruit"
        LEAF = "leaf", "Leaf"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    organ_type = models.CharField(max_length=20, choices=OrganType.choices, db_index=True)
    ai_label = models.CharField(max_length=120, db_index=True)
    summary = models.TextField(blank=True)
    symptoms = models.TextField(blank=True)
    prevention = models.TextField(blank=True)

    class Meta:
        ordering = ("organ_type", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("organ_type", "ai_label"),
                name="unique_disease_ai_label_per_organ_type",
            )
        ]

    def save(self, *args, **kwargs):
        self.ai_label = normalize_ai_label(self.ai_label)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.organ_type})"


class DiseaseMapProfile(UUIDPrimaryKeyModel, TimeStampedModel):
    class SpreadCategory(models.TextChoices):
        NONE = "none", "None"
        FUNGAL = "fungal", "Fungal"
        BACTERIAL = "bacterial", "Bacterial"
        VIRAL = "viral", "Viral"
        OOMYCETE = "oomycete", "Oomycete"
        PHYSIOLOGICAL = "physiological", "Physiological"
        ENVIRONMENTAL = "environmental", "Environmental"
        UNKNOWN = "unknown", "Unknown"

    class TransmissionMode(models.TextChoices):
        NONE = "none", "None"
        SPLASH = "splash", "Splash"
        AIRBORNE = "airborne", "Airborne"
        CONTACT = "contact", "Contact"
        SOIL = "soil", "Soil"
        SEED = "seed", "Seed"
        VECTOR_THRIPS = "vector_thrips", "Vector thrips"
        VECTOR_WHITEFLY = "vector_whitefly", "Vector whitefly"
        HUMIDITY_RELATED = "humidity_related", "Humidity related"
        WATER_STRESS = "water_stress", "Water stress"
        NUTRIENT_WATER_IMBALANCE = "nutrient_water_imbalance", "Nutrient/water imbalance"
        DEVELOPMENT_DISORDER = "development_disorder", "Development disorder"
        UNKNOWN = "unknown", "Unknown"

    class ZoneType(models.TextChoices):
        NONE = "none", "None"
        INFECTION_ZONE = "infection_zone", "Infection zone"
        RISK_ZONE = "risk_zone", "Risk zone"
        VECTOR_RISK_ZONE = "vector_risk_zone", "Vector risk zone"
        AGRONOMIC_RISK_ZONE = "agronomic_risk_zone", "Agronomic risk zone"

    class RiskLevel(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    disease = models.OneToOneField(
        Disease,
        on_delete=models.CASCADE,
        related_name="map_profile",
    )
    is_infectious = models.BooleanField(default=False)
    spread_category = models.CharField(
        max_length=32,
        choices=SpreadCategory.choices,
        default=SpreadCategory.NONE,
    )
    transmission_mode = models.CharField(
        max_length=64,
        choices=TransmissionMode.choices,
        default=TransmissionMode.NONE,
    )
    zone_type = models.CharField(
        max_length=32,
        choices=ZoneType.choices,
        default=ZoneType.NONE,
    )
    spread_radius_m = models.FloatField(default=0, validators=[MinValueValidator(0)])
    risk_level = models.CharField(
        max_length=16,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW,
    )
    map_color = models.CharField(max_length=16, blank=True)
    map_label = models.CharField(max_length=120, blank=True)
    short_map_description = models.TextField(blank=True)
    source_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("disease__organ_type", "disease__name")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(spread_radius_m__gte=0),
                name="disease_map_profile_spread_radius_non_negative",
            )
        ]

    def __str__(self) -> str:
        return f"{self.disease} map profile"


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
