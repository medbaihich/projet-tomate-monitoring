from rest_framework import serializers

from apps.catalog.models import (
    Disease,
    DiseaseCause,
    DiseaseMapProfile,
    DiseaseResource,
    DiseaseTreatment,
    normalize_ai_label,
)


class DiseaseCauseSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseCause
        fields = (
            "id",
            "disease",
            "title",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class DiseaseTreatmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseTreatment
        fields = (
            "id",
            "disease",
            "title",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class DiseaseResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseResource
        fields = (
            "id",
            "disease",
            "title",
            "url",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class DiseaseMapProfileSerializer(serializers.ModelSerializer):
    disease_name = serializers.CharField(source="disease.name", read_only=True)
    disease_organ_type = serializers.CharField(source="disease.organ_type", read_only=True)
    disease_ai_label = serializers.CharField(source="disease.ai_label", read_only=True)

    class Meta:
        model = DiseaseMapProfile
        fields = (
            "id",
            "disease",
            "disease_name",
            "disease_organ_type",
            "disease_ai_label",
            "is_infectious",
            "spread_category",
            "transmission_mode",
            "zone_type",
            "spread_radius_m",
            "risk_level",
            "map_color",
            "map_label",
            "short_map_description",
            "source_notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "disease_name",
            "disease_organ_type",
            "disease_ai_label",
            "created_at",
            "updated_at",
        )


class DiseaseSerializer(serializers.ModelSerializer):
    causes = DiseaseCauseSerializer(many=True, read_only=True)
    treatments = DiseaseTreatmentSerializer(many=True, read_only=True)
    resources = DiseaseResourceSerializer(many=True, read_only=True)
    map_profile = DiseaseMapProfileSerializer(read_only=True)

    class Meta:
        model = Disease
        fields = (
            "id",
            "name",
            "slug",
            "organ_type",
            "ai_label",
            "summary",
            "symptoms",
            "prevention",
            "causes",
            "treatments",
            "resources",
            "map_profile",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_ai_label(self, value):
        normalized = normalize_ai_label(value)
        if not normalized:
            raise serializers.ValidationError("AI label is required.")
        return normalized
