from rest_framework import serializers

from apps.review.models import Review


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = (
            "id",
            "inspection",
            "reviewer",
            "corrected_disease",
            "decision",
            "comments",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "reviewed_at", "created_at", "updated_at")

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
