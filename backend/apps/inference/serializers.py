from rest_framework import serializers

from apps.inference.models import InferenceIndex, ModelVersion


class InferenceIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = InferenceIndex
        fields = (
            "id",
            "model_version",
            "name",
            "organ_type",
            "index_path",
            "metadata_path",
            "threshold_default",
            "top_k_default",
            "is_active",
            "loaded_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_threshold_default(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("Threshold default must be between 0 and 1.")
        return value


class ModelVersionSerializer(serializers.ModelSerializer):
    indexes = InferenceIndexSerializer(many=True, read_only=True)

    class Meta:
        model = ModelVersion
        fields = (
            "id",
            "name",
            "version",
            "framework",
            "artifact_path",
            "checksum",
            "is_active",
            "notes",
            "indexes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
