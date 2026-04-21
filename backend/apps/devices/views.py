from rest_framework import viewsets

from apps.accounts.permissions import IsAuthenticatedReadOnlyOrAdminWrite
from apps.core.api import apply_query_filters
from apps.devices.models import Device, Greenhouse, Site, Zone
from apps.devices.serializers import (
    DeviceSerializer,
    GreenhouseSerializer,
    SiteSerializer,
    ZoneSerializer,
)


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.prefetch_related(
        "greenhouses__zones__devices",
    )
    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "location")
    ordering_fields = ("name", "location", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"name": "name__icontains"})


class GreenhouseViewSet(viewsets.ModelViewSet):
    queryset = Greenhouse.objects.select_related("site").prefetch_related("zones__devices")
    serializer_class = GreenhouseSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "description", "site__name")
    ordering_fields = ("name", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"site": "site_id"})


class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.select_related("greenhouse", "greenhouse__site").prefetch_related("devices")
    serializer_class = ZoneSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "description", "greenhouse__name", "greenhouse__site__name")
    ordering_fields = ("name", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "greenhouse": "greenhouse_id",
                "site": "greenhouse__site_id",
            },
        )


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.select_related("zone", "zone__greenhouse", "zone__greenhouse__site")
    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = (
        "name",
        "identifier",
        "description",
        "zone__name",
        "zone__greenhouse__name",
        "zone__greenhouse__site__name",
    )
    ordering_fields = ("name", "identifier", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "zone": "zone_id",
                "greenhouse": "zone__greenhouse_id",
                "site": "zone__greenhouse__site_id",
                "identifier": "identifier",
            },
        )
