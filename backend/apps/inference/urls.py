from rest_framework.routers import DefaultRouter

from apps.inference.views import InferenceIndexViewSet, ModelVersionViewSet

router = DefaultRouter()
router.register("model-versions", ModelVersionViewSet, basename="model-version")
router.register("indexes", InferenceIndexViewSet, basename="inference-index")

urlpatterns = router.urls
