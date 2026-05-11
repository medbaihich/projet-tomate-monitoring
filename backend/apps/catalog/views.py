from rest_framework import viewsets

from apps.accounts.permissions import IsAuthenticatedReadOnlyOrAdminWrite
from apps.core.api import apply_query_filters
from apps.catalog.models import (
    Disease,
    DiseaseCause,
    DiseaseMapProfile,
    DiseaseResource,
    DiseaseTreatment,
)
from apps.catalog.serializers import (
    DiseaseCauseSerializer,
    DiseaseMapProfileSerializer,
    DiseaseResourceSerializer,
    DiseaseSerializer,
    DiseaseTreatmentSerializer,
)


class DiseaseViewSet(viewsets.ModelViewSet):
    queryset = Disease.objects.prefetch_related("causes", "treatments", "resources").select_related("map_profile")
    serializer_class = DiseaseSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "slug", "ai_label", "summary", "symptoms", "prevention")
    ordering_fields = ("organ_type", "ai_label", "name", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "name": "name__icontains",
                "slug": "slug",
                "organ_type": "organ_type",
                "ai_label": "ai_label",
            },
        )


class DiseaseMapProfileViewSet(viewsets.ModelViewSet):
    queryset = DiseaseMapProfile.objects.select_related("disease")
    serializer_class = DiseaseMapProfileSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("disease__name", "disease__slug", "disease__ai_label", "map_label")
    ordering_fields = (
        "disease__organ_type",
        "disease__name",
        "spread_category",
        "transmission_mode",
        "zone_type",
        "spread_radius_m",
        "risk_level",
        "is_active",
        "created_at",
        "updated_at",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "disease": "disease_id",
                "organ_type": "disease__organ_type",
                "ai_label": "disease__ai_label",
                "is_infectious": "is_infectious",
                "spread_category": "spread_category",
                "transmission_mode": "transmission_mode",
                "zone_type": "zone_type",
                "risk_level": "risk_level",
                "is_active": "is_active",
            },
        )


class DiseaseCauseViewSet(viewsets.ModelViewSet):
    queryset = DiseaseCause.objects.select_related("disease")
    serializer_class = DiseaseCauseSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("title", "description", "disease__name")
    ordering_fields = ("title", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"disease": "disease_id"})


class DiseaseTreatmentViewSet(viewsets.ModelViewSet):
    queryset = DiseaseTreatment.objects.select_related("disease")
    serializer_class = DiseaseTreatmentSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("title", "description", "disease__name")
    ordering_fields = ("title", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"disease": "disease_id"})


class DiseaseResourceViewSet(viewsets.ModelViewSet):
    queryset = DiseaseResource.objects.select_related("disease")
    serializer_class = DiseaseResourceSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("title", "description", "url", "disease__name")
    ordering_fields = ("title", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"disease": "disease_id"})
