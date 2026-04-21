from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.monitoring.serializers import (
    MonitoringNotificationSerializer,
    MonitoringSummarySerializer,
    MonitoringUserSummarySerializer,
    NotificationReadActivitySerializer,
)
from apps.monitoring.services import (
    build_monitoring_summary,
    build_notification_activity_queryset,
    build_recent_notification_read_events_queryset,
    build_user_activity_queryset,
    get_active_user_threshold,
)
from apps.notifications.models import Notification


class AdminMonitoringPermissionMixin:
    permission_classes = [IsAuthenticated, IsAdminRole]


class MonitoringSummaryView(AdminMonitoringPermissionMixin, APIView):
    def get(self, request, *args, **kwargs):
        summary_payload = build_monitoring_summary()
        serializer = MonitoringSummarySerializer(
            summary_payload,
            context={
                "total_user_count": summary_payload["summary"]["total_user_count"],
                "active_user_threshold": get_active_user_threshold(summary_payload["generated_at"]),
            },
        )
        return Response(serializer.data)


class NotificationActivityListView(AdminMonitoringPermissionMixin, generics.ListAPIView):
    serializer_class = MonitoringNotificationSerializer

    def get_queryset(self):
        self.total_user_count = build_user_activity_queryset().count()
        return build_notification_activity_queryset()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["total_user_count"] = getattr(self, "total_user_count", build_user_activity_queryset().count())
        return context


class NotificationReadActivityListView(AdminMonitoringPermissionMixin, generics.ListAPIView):
    serializer_class = NotificationReadActivitySerializer

    def get_queryset(self):
        queryset = build_recent_notification_read_events_queryset()
        notification_id = self.request.query_params.get("notification")
        user_id = self.request.query_params.get("user")
        if notification_id:
            queryset = queryset.filter(notification_id=notification_id)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["active_user_threshold"] = get_active_user_threshold()
        return context


class NotificationReadersListView(AdminMonitoringPermissionMixin, generics.ListAPIView):
    serializer_class = NotificationReadActivitySerializer

    def get_queryset(self):
        notification = get_object_or_404(Notification, pk=self.kwargs["pk"])
        return build_recent_notification_read_events_queryset().filter(notification=notification)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["active_user_threshold"] = get_active_user_threshold()
        return context


class UserActivityListView(AdminMonitoringPermissionMixin, generics.ListAPIView):
    serializer_class = MonitoringUserSummarySerializer

    def get_queryset(self):
        queryset = build_user_activity_queryset()
        status_filter = (self.request.query_params.get("status") or "").strip().lower()
        threshold = get_active_user_threshold()

        if status_filter == "active":
            return queryset.filter(last_seen_at__gte=threshold)

        if status_filter == "offline":
            return queryset.exclude(last_seen_at__gte=threshold)

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["active_user_threshold"] = get_active_user_threshold()
        return context
