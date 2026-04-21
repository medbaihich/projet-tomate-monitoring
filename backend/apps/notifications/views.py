from django.db import transaction
from django.db.models import BooleanField, DateTimeField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.api import apply_query_filters
from apps.notifications.models import Notification, NotificationUserState
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Notification.objects.select_related("inspection", "disease")
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = (
        "title",
        "message",
        "display_disease_label",
        "inspection__source_message_id",
        "inspection__top1_label",
    )
    ordering_fields = ("created_at", "updated_at", "confidence_score", "severity")

    def get_queryset(self):
        queryset = self._annotate_current_user_state(super().get_queryset())
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "inspection": "inspection_id",
                "disease": "disease_id",
                "event_type": "event_type",
                "severity": "severity",
                "is_read": "current_user_is_read",
            },
        )

    def _annotate_current_user_state(self, queryset):
        user = self.request.user
        user_state_queryset = NotificationUserState.objects.filter(
            notification_id=OuterRef("pk"),
            user=user,
        )

        return queryset.annotate(
            current_user_is_read=Coalesce(
                Subquery(
                    user_state_queryset.values("is_read")[:1],
                    output_field=BooleanField(),
                ),
                Value(False),
            ),
            current_user_read_at=Subquery(
                user_state_queryset.values("read_at")[:1],
                output_field=DateTimeField(),
            ),
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, *args, **kwargs):
        notification = self.get_object()
        marked_at = timezone.now()
        state, created = NotificationUserState.objects.get_or_create(
            user=request.user,
            notification=notification,
            defaults={
                "is_read": True,
                "read_at": marked_at,
            },
        )

        if not created and not state.is_read:
            state.is_read = True
            state.read_at = marked_at
            state.save(update_fields=["is_read", "read_at", "updated_at"])

        notification.current_user_is_read = True
        notification.current_user_read_at = state.read_at or marked_at

        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request, *args, **kwargs):
        marked_at = timezone.now()
        notification_ids = list(self.get_queryset().values_list("id", flat=True))

        if not notification_ids:
            return Response({"marked_count": 0}, status=status.HTTP_200_OK)

        with transaction.atomic():
            marked_count = NotificationUserState.objects.filter(
                user=request.user,
                notification_id__in=notification_ids,
                is_read=False,
            ).update(
                is_read=True,
                read_at=marked_at,
                updated_at=marked_at,
            )

            existing_state_ids = set(
                NotificationUserState.objects.filter(
                    user=request.user,
                    notification_id__in=notification_ids,
                ).values_list("notification_id", flat=True)
            )
            missing_ids = [
                notification_id
                for notification_id in notification_ids
                if notification_id not in existing_state_ids
            ]

            NotificationUserState.objects.bulk_create(
                [
                    NotificationUserState(
                        user=request.user,
                        notification_id=notification_id,
                        is_read=True,
                        read_at=marked_at,
                    )
                    for notification_id in missing_ids
                ]
            )
            marked_count += len(missing_ids)

        return Response({"marked_count": marked_count}, status=status.HTTP_200_OK)

