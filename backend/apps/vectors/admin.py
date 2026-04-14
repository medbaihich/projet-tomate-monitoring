from django.contrib import admin

from apps.vectors.models import EmbeddingRecord


@admin.register(EmbeddingRecord)
class EmbeddingRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "model_version", "inspection", "label", "created_at")
    list_filter = ("model_version",)
    search_fields = ("label", "notes", "inspection__source_message_id")
    ordering = ("-created_at",)
