from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error

from apps.core.api import apply_query_filters
from apps.review.models import Review
from apps.review.serializers import ReviewSerializer
from apps.review.services import create_review


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related(
        "inspection",
        "reviewer",
        "corrected_disease",
    )
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]
    search_fields = (
        "inspection__source_message_id",
        "inspection__top1_label",
        "reviewer__username",
        "corrected_disease__name",
        "comments",
    )
    ordering_fields = ("reviewed_at", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "inspection": "inspection_id",
                "reviewer": "reviewer_id",
                "corrected_disease": "corrected_disease_id",
                "decision": "decision",
            },
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            review = create_review(
                review_data=serializer.validated_data,
                default_reviewer=request.user if request.user.is_authenticated else None,
            )
        except DjangoValidationError as exc:
            raise self.validation_error(exc)

        output_serializer = self.get_serializer(review)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        serializer.save(reviewed_at=timezone.now())

    def validation_error(self, exception):
        return ValidationError(as_serializer_error(exception))
