from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.api import apply_query_filters
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inference.serializers import InferenceIndexSerializer, ModelVersionSerializer


class ModelVersionViewSet(viewsets.ModelViewSet):
    queryset = ModelVersion.objects.prefetch_related("indexes")
    serializer_class = ModelVersionSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "version", "framework", "checksum", "notes")
    ordering_fields = ("name", "version", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "name": "name__icontains",
                "version": "version",
                "is_active": "is_active",
            },
        )


class InferenceIndexViewSet(viewsets.ModelViewSet):
    queryset = InferenceIndex.objects.select_related("model_version")
    serializer_class = InferenceIndexSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "index_path", "metadata_path", "notes", "model_version__name")
    ordering_fields = ("name", "organ_type", "created_at", "updated_at", "loaded_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "model_version": "model_version_id",
                "organ_type": "organ_type",
                "is_active": "is_active",
                "name": "name__icontains",
            },
        )
