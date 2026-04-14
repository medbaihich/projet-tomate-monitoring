from django.contrib import admin

from apps.inference.models import InferenceIndex, ModelVersion


class InferenceIndexInline(admin.TabularInline):
    model = InferenceIndex
    extra = 0


@admin.register(ModelVersion)
class ModelVersionAdmin(admin.ModelAdmin):
    list_display = ("name", "version", "framework", "is_active", "created_at", "updated_at")
    list_filter = ("is_active", "framework")
    search_fields = ("name", "version", "framework", "checksum")
    ordering = ("name", "version")
    inlines = (InferenceIndexInline,)


@admin.register(InferenceIndex)
class InferenceIndexAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organ_type",
        "model_version",
        "threshold_default",
        "top_k_default",
        "is_active",
        "loaded_at",
    )
    list_filter = ("is_active", "organ_type", "model_version")
    search_fields = (
        "name",
        "model_version__name",
        "model_version__version",
        "index_path",
        "metadata_path",
    )
    ordering = ("name",)
