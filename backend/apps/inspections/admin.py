from django.contrib import admin
from django import forms

from apps.inspections.models import Inspection, InspectionMatch


class InspectionMatchInline(admin.TabularInline):
    model = InspectionMatch
    extra = 0


class InspectionAdminForm(forms.ModelForm):
    class Meta:
        model = Inspection
        fields = "__all__"
        widgets = {
            "confidence_score": forms.NumberInput(
                attrs={
                    "step": "any",
                    "min": "0",
                    "max": "1",
                }
            )
        }


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    form = InspectionAdminForm
    list_display = (
        "device",
        "organ_type",
        "status",
        "processing_status",
        "top1_label",
        "confidence_score",
        "captured_at",
    )
    list_filter = ("organ_type", "status", "processing_status", "inference_index")
    search_fields = (
        "device__name",
        "device__identifier",
        "source_message_id",
        "top1_label",
        "predicted_disease__name",
    )
    ordering = ("-captured_at",)
    inlines = (InspectionMatchInline,)


@admin.register(InspectionMatch)
class InspectionMatchAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "rank_order",
        "matched_label",
        "similarity_score",
        "disease",
    )
    list_filter = ("disease",)
    search_fields = ("matched_label", "inspection__source_message_id", "disease__name")
    ordering = ("inspection", "rank_order")
