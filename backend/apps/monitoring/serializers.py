from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.monitoring.services import get_active_user_threshold
from apps.notifications.models import Notification, NotificationUserState


class MonitoringNotificationSerializer(serializers.ModelSerializer):
    read_user_count = serializers.IntegerField(read_only=True)
    unread_user_count = serializers.SerializerMethodField()
    latest_read_at = serializers.DateTimeField(read_only=True)

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
            "created_at",
            "updated_at",
            "read_user_count",
            "unread_user_count",
            "latest_read_at",
        )
        read_only_fields = fields

    def get_unread_user_count(self, obj):
        total_user_count = self.context.get("total_user_count", 0)
        read_user_count = getattr(obj, "read_user_count", 0) or 0
        return max(total_user_count - read_user_count, 0)


class MonitoringUserSummarySerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "role",
            "status",
            "last_seen_at",
        )
        read_only_fields = fields

    def get_role(self, obj):
        if obj.role is None:
            return None

        return {
            "id": str(obj.role_id),
            "name": obj.role.name,
        }

    def get_status(self, obj):
        if obj.last_seen_at is None:
            return "offline"

        threshold = self.context.get("active_user_threshold") or get_active_user_threshold(timezone.now())
        return "active" if obj.last_seen_at >= threshold else "offline"


class NotificationReadActivitySerializer(serializers.ModelSerializer):
    user = MonitoringUserSummarySerializer(read_only=True)
    notification_id = serializers.UUIDField(source="notification.id", read_only=True)
    notification_title = serializers.CharField(source="notification.title", read_only=True)
    notification_event_type = serializers.CharField(source="notification.event_type", read_only=True)
    notification_severity = serializers.CharField(source="notification.severity", read_only=True)

    class Meta:
        model = NotificationUserState
        fields = (
            "id",
            "notification_id",
            "notification_title",
            "notification_event_type",
            "notification_severity",
            "user",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class MonitoringSummarySerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField()
    summary = serializers.DictField()
    latest_notifications = MonitoringNotificationSerializer(many=True)
    recent_read_activity = NotificationReadActivitySerializer(many=True)
