from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()
    read_at = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "inspection",
            "disease",
            "event_type",
            "severity",
            "title",
            "message",
            "display_disease_label",
            "confidence_score",
            "payload",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_is_read(self, obj):
        if hasattr(obj, "current_user_is_read"):
            return bool(obj.current_user_is_read)

        return False

    def get_read_at(self, obj):
        if hasattr(obj, "current_user_read_at"):
            return obj.current_user_read_at

        return None
