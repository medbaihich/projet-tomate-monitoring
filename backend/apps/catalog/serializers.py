from rest_framework import serializers

from apps.catalog.models import (
    Disease,
    DiseaseCause,
    DiseaseResource,
    DiseaseTreatment,
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


class DiseaseSerializer(serializers.ModelSerializer):
    causes = DiseaseCauseSerializer(many=True, read_only=True)
    treatments = DiseaseTreatmentSerializer(many=True, read_only=True)
    resources = DiseaseResourceSerializer(many=True, read_only=True)

    class Meta:
        model = Disease
        fields = (
            "id",
            "name",
            "slug",
            "summary",
            "symptoms",
            "prevention",
            "causes",
            "treatments",
            "resources",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
