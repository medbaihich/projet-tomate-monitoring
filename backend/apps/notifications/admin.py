from django.contrib import admin

from apps.notifications.models import Notification, NotificationUserState


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "event_type",
        "severity",
        "display_disease_label",
        "inspection",
        "is_read",
        "created_at",
    )
    list_filter = ("event_type", "severity", "is_read")
    search_fields = (
        "title",
        "message",
        "display_disease_label",
        "inspection__source_message_id",
        "inspection__top1_label",
    )
    readonly_fields = ("created_at", "updated_at", "read_at")


@admin.register(NotificationUserState)
class NotificationUserStateAdmin(admin.ModelAdmin):
    list_display = ("user", "notification", "is_read", "read_at", "updated_at")
    list_filter = ("is_read",)
    search_fields = ("user__username", "notification__title", "notification__display_disease_label")


