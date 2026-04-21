from datetime import timedelta

from django.db.models import Count, Max, Q
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.models import Notification, NotificationUserState


ACTIVE_USER_WINDOW = timedelta(minutes=5)
DEFAULT_RECENT_NOTIFICATIONS_LIMIT = 5
DEFAULT_RECENT_READ_EVENTS_LIMIT = 10
DEFAULT_RECENT_USERS_LIMIT = 10


def get_active_user_threshold(now=None):
    current_time = now or timezone.now()
    return current_time - ACTIVE_USER_WINDOW


def build_notification_activity_queryset():
    return Notification.objects.select_related("inspection", "disease").annotate(
        read_user_count=Count(
            "user_states__user",
            filter=Q(user_states__is_read=True),
            distinct=True,
        ),
        latest_read_at=Max(
            "user_states__read_at",
            filter=Q(user_states__is_read=True),
        ),
    ).order_by("-created_at")


def build_recent_notification_read_events_queryset():
    return NotificationUserState.objects.filter(
        is_read=True,
        read_at__isnull=False,
    ).select_related(
        "user__role",
        "notification__inspection",
        "notification__disease",
    ).order_by("-read_at", "-updated_at")


def build_user_activity_queryset():
    return User.objects.select_related("role").filter(is_active=True).order_by(
        "-last_seen_at",
        "username",
    )


def build_monitoring_summary(*, recent_notifications_limit=DEFAULT_RECENT_NOTIFICATIONS_LIMIT, recent_read_events_limit=DEFAULT_RECENT_READ_EVENTS_LIMIT):
    total_user_count = User.objects.filter(is_active=True).count()
    active_threshold = get_active_user_threshold()
    active_user_count = User.objects.filter(
        is_active=True,
        last_seen_at__gte=active_threshold,
    ).count()

    notifications = build_notification_activity_queryset()
    total_notifications = notifications.count()
    notifications_with_reads = notifications.filter(read_user_count__gt=0).count()
    unread_notifications = total_notifications - notifications_with_reads
    total_read_events = NotificationUserState.objects.filter(is_read=True).count()
    recent_notifications = list(notifications[:recent_notifications_limit])
    recent_read_events = list(
        build_recent_notification_read_events_queryset()[:recent_read_events_limit]
    )

    return {
        "generated_at": timezone.now(),
        "summary": {
            "total_notifications": total_notifications,
            "notifications_with_reads": notifications_with_reads,
            "notifications_without_reads": unread_notifications,
            "total_read_events": total_read_events,
            "active_user_count": active_user_count,
            "total_user_count": total_user_count,
            "active_user_window_minutes": int(ACTIVE_USER_WINDOW.total_seconds() // 60),
        },
        "latest_notifications": recent_notifications,
        "recent_read_activity": recent_read_events,
    }
