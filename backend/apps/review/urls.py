from rest_framework.routers import DefaultRouter

from apps.review.views import ReviewViewSet

router = DefaultRouter()
router.register("reviews", ReviewViewSet, basename="review")

urlpatterns = router.urls
