from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.api import apply_query_filters
from apps.inspections.services import create_inspection_with_matches
from apps.inspections.models import Inspection, InspectionMatch
from apps.inspections.serializers import (
    InspectionCreateSerializer,
    InspectionMatchSerializer,
    InspectionSerializer,
)
from apps.notifications.services import (
    is_inspection_alert_eligible,
    maybe_create_disease_alert_notification,
)


class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.select_related(
        "device",
        "inference_index",
        "predicted_disease",
    ).prefetch_related("matches__disease")
    permission_classes = [IsAuthenticated]
    search_fields = ("source_message_id", "top1_label", "device__name", "device__identifier")
    ordering_fields = (
        "captured_at",
        "received_at",
        "processed_at",
        "created_at",
        "updated_at",
        "confidence_score",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "device": "device_id",
                "inference_index": "inference_index_id",
                "predicted_disease": "predicted_disease_id",
                "organ_type": "organ_type",
                "status": "status",
                "processing_status": "processing_status",
                "source_message_id": "source_message_id",
            },
        )

    def get_serializer_class(self):
        if self.action == "create":
            return InspectionCreateSerializer
        return InspectionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            inspection = create_inspection_with_matches(
                inspection_data={
                    key: value
                    for key, value in serializer.validated_data.items()
                    if key != "matches"
                },
                matches_data=serializer.validated_data.get("matches", []),
            )
        except DjangoValidationError as exc:
            detail = getattr(exc, "message_dict", None) or getattr(exc, "messages", None) or str(exc)
            raise DRFValidationError(detail)

        output_serializer = InspectionSerializer(
            inspection,
            context=self.get_serializer_context(),
        )
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        inspection_before_update = (
            Inspection.objects.select_related(
                "device",
                "inference_index",
                "predicted_disease",
            )
            .prefetch_related("matches__disease")
            .get(pk=serializer.instance.pk)
        )
        was_alert_eligible = is_inspection_alert_eligible(inspection_before_update)

        inspection = serializer.save()
        inspection = (
            Inspection.objects.select_related(
                "device",
                "inference_index",
                "predicted_disease",
            )
            .prefetch_related("matches__disease")
            .get(pk=inspection.pk)
        )

        if not was_alert_eligible:
            maybe_create_disease_alert_notification(inspection)


class InspectionMatchViewSet(viewsets.ModelViewSet):
    queryset = InspectionMatch.objects.select_related("inspection", "disease")
    serializer_class = InspectionMatchSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ("matched_label", "inspection__source_message_id", "disease__name")
    ordering_fields = ("rank_order", "similarity_score", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "inspection": "inspection_id",
                "disease": "disease_id",
            },
        )
