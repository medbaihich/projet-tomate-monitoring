from rest_framework import serializers

from apps.review.models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_summary = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "inspection",
            "reviewer",
            "reviewer_summary",
            "corrected_disease",
            "decision",
            "comments",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "reviewed_at", "created_at", "updated_at", "reviewer_summary")

    def get_reviewer_summary(self, obj):
        if obj.reviewer is None:
            return None

        full_name = obj.reviewer.get_full_name().strip() or obj.reviewer.username
        return {
            "id": str(obj.reviewer_id),
            "username": obj.reviewer.username,
            "full_name": full_name,
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)

        decision = attrs.get("decision")
        corrected_disease = attrs.get("corrected_disease")

        if self.instance is not None:
            if decision is None:
                decision = self.instance.decision
            if corrected_disease is None:
                corrected_disease = self.instance.corrected_disease

        if decision == Review.Decision.CORRECTED and corrected_disease is None:
            raise serializers.ValidationError(
                {
                    "corrected_disease": "A corrected disease is required when the review decision is corrected."
                }
            )

        return attrs
