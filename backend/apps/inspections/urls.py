from rest_framework.routers import DefaultRouter

from apps.inspections.views import InspectionMatchViewSet, InspectionViewSet

router = DefaultRouter()
router.register("inspections", InspectionViewSet, basename="inspection")
router.register("inspection-matches", InspectionMatchViewSet, basename="inspection-match")

urlpatterns = router.urls
