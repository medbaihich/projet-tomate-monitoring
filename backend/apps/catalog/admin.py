from django.contrib import admin

from apps.catalog.models import (
    Disease,
    DiseaseCause,
    DiseaseResource,
    DiseaseTreatment,
)


class DiseaseCauseInline(admin.TabularInline):
    model = DiseaseCause
    extra = 0


class DiseaseTreatmentInline(admin.TabularInline):
    model = DiseaseTreatment
    extra = 0


class DiseaseResourceInline(admin.TabularInline):
    model = DiseaseResource
    extra = 0


@admin.register(Disease)
class DiseaseAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at", "updated_at")
    search_fields = ("name", "summary", "symptoms")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("name",)
    inlines = (DiseaseCauseInline, DiseaseTreatmentInline, DiseaseResourceInline)


@admin.register(DiseaseCause)
class DiseaseCauseAdmin(admin.ModelAdmin):
    list_display = ("title", "disease", "created_at", "updated_at")
    list_filter = ("disease",)
    search_fields = ("title", "description", "disease__name")


@admin.register(DiseaseTreatment)
class DiseaseTreatmentAdmin(admin.ModelAdmin):
    list_display = ("title", "disease", "created_at", "updated_at")
    list_filter = ("disease",)
    search_fields = ("title", "description", "disease__name")


@admin.register(DiseaseResource)
class DiseaseResourceAdmin(admin.ModelAdmin):
    list_display = ("title", "disease", "url", "created_at", "updated_at")
    list_filter = ("disease",)
    search_fields = ("title", "description", "disease__name", "url")
