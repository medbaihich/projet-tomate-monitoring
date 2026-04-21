from django.contrib import admin
from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework.schemas import get_schema_view

from apps.core.views import HealthCheckView, LegacyHealthCheckView

schema_view = get_schema_view(
    title="Backend API",
    description="OpenAPI schema for the backend API.",
    version="v1",
    public=True,
    permission_classes=[AllowAny],
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", LegacyHealthCheckView.as_view(), name="health-check"),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check-v1"),
    path("api/v1/schema/", schema_view, name="openapi-schema"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/catalog/", include("apps.catalog.urls")),
    path("api/v1/devices/", include("apps.devices.urls")),
    path("api/v1/inference/", include("apps.inference.urls")),
    path("api/v1/inspections/", include("apps.inspections.urls")),
    path("api/v1/monitoring/", include("apps.monitoring.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/review/", include("apps.review.urls")),
]
