from rest_framework.routers import DefaultRouter
from django.urls import path

from apps.inspections.views import (
    InspectionMapSignalsView,
    InspectionMatchViewSet,
    InspectionViewSet,
)

router = DefaultRouter()
router.register("inspections", InspectionViewSet, basename="inspection")
router.register("inspection-matches", InspectionMatchViewSet, basename="inspection-match")

urlpatterns = [
    path("map-signals/", InspectionMapSignalsView.as_view(), name="inspection-map-signals"),
    *router.urls,
]
