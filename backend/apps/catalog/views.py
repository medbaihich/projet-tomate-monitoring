from rest_framework import viewsets

from apps.accounts.permissions import IsAuthenticatedReadOnlyOrAdminWrite
from apps.core.api import apply_query_filters
from apps.catalog.models import (
    Disease,
    DiseaseCause,
    DiseaseResource,
    DiseaseTreatment,
)
from apps.catalog.serializers import (
    DiseaseCauseSerializer,
    DiseaseResourceSerializer,
    DiseaseSerializer,
    DiseaseTreatmentSerializer,
)


class DiseaseViewSet(viewsets.ModelViewSet):
    queryset = Disease.objects.prefetch_related("causes", "treatments", "resources")
    serializer_class = DiseaseSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "slug", "summary", "symptoms", "prevention")
    ordering_fields = ("name", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "name": "name__icontains",
                "slug": "slug",
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
