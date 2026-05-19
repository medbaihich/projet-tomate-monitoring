from datetime import date, datetime, time
from uuid import UUID

from rest_framework import serializers

from apps.notifications.models import Notification


def _to_json_safe_primitive(value):
    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, (datetime, date, time)):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: _to_json_safe_primitive(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [_to_json_safe_primitive(item) for item in value]

    return value


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

    def to_representation(self, instance):
        return _to_json_safe_primitive(super().to_representation(instance))
