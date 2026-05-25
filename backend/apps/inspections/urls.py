from rest_framework.routers import DefaultRouter
from django.urls import path

from apps.inspections.views import (
    InspectionAIResultIngestionView,
    InspectionEvidenceImageUploadView,
    InspectionMapSignalsView,
    InspectionMatchViewSet,
    InspectionViewSet,
)

router = DefaultRouter()
router.register("inspections", InspectionViewSet, basename="inspection")
router.register("inspection-matches", InspectionMatchViewSet, basename="inspection-match")

urlpatterns = [
    path("ingest-ai-result/", InspectionAIResultIngestionView.as_view(), name="inspection-ingest-ai-result"),
    path(
        "evidence-images/upload/",
        InspectionEvidenceImageUploadView.as_view(),
        name="inspection-evidence-image-upload",
    ),
    path("map-signals/", InspectionMapSignalsView.as_view(), name="inspection-map-signals"),
    *router.urls,
]
