from rest_framework import serializers

from apps.catalog.models import Disease
from apps.devices.models import Device
from apps.inference.models import InferenceIndex
from apps.inspections.models import Inspection, InspectionMatch


class InspectionMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionMatch
        fields = (
            "id",
            "inspection",
            "disease",
            "rank_order",
            "matched_label",
            "similarity_score",
            "metadata_json",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_similarity_score(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("Similarity score must be between 0 and 1.")
        return value


class InspectionMatchCreateSerializer(serializers.ModelSerializer):
    disease = serializers.PrimaryKeyRelatedField(
        queryset=Disease.objects.all(),
        allow_null=True,
        required=False,
    )
    rank_order = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = InspectionMatch
        fields = (
            "disease",
            "rank_order",
            "matched_label",
            "similarity_score",
            "metadata_json",
        )

    def validate_similarity_score(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("Similarity score must be between 0 and 1.")
        return value


class InspectionSerializer(serializers.ModelSerializer):
    matches = InspectionMatchSerializer(many=True, read_only=True)

    class Meta:
        model = Inspection
        fields = (
            "id",
            "device",
            "inference_index",
            "predicted_disease",
            "organ_type",
            "status",
            "processing_status",
            "source_message_id",
            "top1_label",
            "confidence_score",
            "captured_at",
            "received_at",
            "processed_at",
            "extra_metadata",
            "matches",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_confidence_score(self, value):
        if value is not None and not 0 <= value <= 1:
            raise serializers.ValidationError("Confidence score must be between 0 and 1.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        inference_index = attrs.get("inference_index")
        organ_type = attrs.get("organ_type")

        if self.instance is not None:
            if inference_index is None:
                inference_index = self.instance.inference_index
            if organ_type is None:
                organ_type = self.instance.organ_type

        if (
            isinstance(inference_index, InferenceIndex)
            and organ_type
            and inference_index.organ_type != organ_type
        ):
            raise serializers.ValidationError(
                {
                    "inference_index": (
                        "The selected inference index organ type must match the inspection organ type."
                    )
                }
            )

        return attrs


class InspectionCreateSerializer(serializers.Serializer):
    device = serializers.PrimaryKeyRelatedField(queryset=Device.objects.all())
    inference_index = serializers.PrimaryKeyRelatedField(queryset=InferenceIndex.objects.all())
    predicted_disease = serializers.PrimaryKeyRelatedField(
        queryset=Disease.objects.all(),
        allow_null=True,
        required=False,
    )
    organ_type = serializers.ChoiceField(choices=Inspection.OrganType.choices)
    status = serializers.ChoiceField(
        choices=Inspection.Status.choices,
        required=False,
        default=Inspection.Status.NEW,
    )
    processing_status = serializers.ChoiceField(
        choices=Inspection.ProcessingStatus.choices,
        required=False,
        default=Inspection.ProcessingStatus.PENDING,
    )
    source_message_id = serializers.CharField(required=False, allow_blank=True)
    top1_label = serializers.CharField(required=False, allow_blank=True)
    confidence_score = serializers.FloatField(required=False, allow_null=True)
    captured_at = serializers.DateTimeField()
    received_at = serializers.DateTimeField()
    processed_at = serializers.DateTimeField(required=False, allow_null=True)
    extra_metadata = serializers.JSONField(required=False)
    matches = InspectionMatchCreateSerializer(many=True, required=False)

    def validate_confidence_score(self, value):
        if value is not None and not 0 <= value <= 1:
            raise serializers.ValidationError("Confidence score must be between 0 and 1.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        inference_index = attrs.get("inference_index")
        organ_type = attrs.get("organ_type")

        if inference_index and organ_type and inference_index.organ_type != organ_type:
            raise serializers.ValidationError(
                {
                    "inference_index": (
                        "The selected inference index organ type must match the inspection organ type."
                    )
                }
            )

        attrs.setdefault("extra_metadata", {})
        attrs.setdefault("matches", [])
        return attrs
