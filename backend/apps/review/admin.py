from django.contrib import admin

from apps.review.models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "decision",
        "reviewer",
        "corrected_disease",
        "reviewed_at",
    )
    list_filter = ("decision", "reviewer")
    search_fields = (
        "inspection__source_message_id",
        "inspection__top1_label",
        "reviewer__username",
        "corrected_disease__name",
        "comments",
    )
    ordering = ("-reviewed_at", "-created_at")
