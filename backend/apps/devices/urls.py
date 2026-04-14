from rest_framework.routers import DefaultRouter

from apps.devices.views import DeviceViewSet, GreenhouseViewSet, SiteViewSet, ZoneViewSet

router = DefaultRouter()
router.register("sites", SiteViewSet, basename="site")
router.register("greenhouses", GreenhouseViewSet, basename="greenhouse")
router.register("zones", ZoneViewSet, basename="zone")
router.register("devices", DeviceViewSet, basename="device")

urlpatterns = router.urls
