from django.contrib import admin

from apps.catalog.models import (
    Disease,
    DiseaseCause,
    DiseaseMapProfile,
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


class DiseaseMapProfileInline(admin.StackedInline):
    model = DiseaseMapProfile
    extra = 0
    max_num = 1


@admin.register(Disease)
class DiseaseAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "organ_type", "ai_label", "created_at", "updated_at")
    list_filter = ("organ_type",)
    search_fields = ("name", "slug", "ai_label")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("organ_type", "name")
    inlines = (
        DiseaseMapProfileInline,
        DiseaseCauseInline,
        DiseaseTreatmentInline,
        DiseaseResourceInline,
    )


@admin.register(DiseaseMapProfile)
class DiseaseMapProfileAdmin(admin.ModelAdmin):
    list_display = (
        "disease",
        "disease_organ_type",
        "disease_ai_label",
        "is_infectious",
        "spread_category",
        "transmission_mode",
        "zone_type",
        "spread_radius_m",
        "risk_level",
        "is_active",
    )
    list_filter = (
        "disease__organ_type",
        "is_infectious",
        "spread_category",
        "transmission_mode",
        "zone_type",
        "risk_level",
        "is_active",
    )
    search_fields = ("disease__name", "disease__slug", "disease__ai_label", "map_label")
    ordering = ("disease__organ_type", "disease__name")

    @admin.display(ordering="disease__organ_type", description="Organ type")
    def disease_organ_type(self, obj):
        return obj.disease.organ_type

    @admin.display(ordering="disease__ai_label", description="AI label")
    def disease_ai_label(self, obj):
        return obj.disease.ai_label


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
