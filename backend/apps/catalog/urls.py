from rest_framework.routers import DefaultRouter

from apps.catalog.views import (
    DiseaseCauseViewSet,
    DiseaseMapProfileViewSet,
    DiseaseResourceViewSet,
    DiseaseTreatmentViewSet,
    DiseaseViewSet,
)

router = DefaultRouter()
router.register("diseases", DiseaseViewSet, basename="disease")
router.register("disease-map-profiles", DiseaseMapProfileViewSet, basename="disease-map-profile")
router.register("disease-causes", DiseaseCauseViewSet, basename="disease-cause")
router.register("disease-treatments", DiseaseTreatmentViewSet, basename="disease-treatment")
router.register("disease-resources", DiseaseResourceViewSet, basename="disease-resource")

urlpatterns = router.urls
