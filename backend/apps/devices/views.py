from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedReadOnlyOrAdminWrite
from apps.core.api import FALSE_VALUES, TRUE_VALUES, apply_query_filters
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.devices.serializers import (
    DeviceMapSerializer,
    DeviceSerializer,
    GreenhouseSerializer,
    LineSerializer,
    SiteSerializer,
    ZoneSerializer,
)


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.prefetch_related(
        "greenhouses__zones__lines__devices",
    )
    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "location")
    ordering_fields = ("name", "location", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"name": "name__icontains"})


class GreenhouseViewSet(viewsets.ModelViewSet):
    queryset = Greenhouse.objects.select_related("site").prefetch_related("zones__lines__devices")
    serializer_class = GreenhouseSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = ("name", "description", "site__name")
    ordering_fields = ("name", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(queryset, self.request.query_params, {"site": "site_id"})


class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.select_related("greenhouse", "greenhouse__site").prefetch_related("lines__devices")
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


class LineViewSet(viewsets.ModelViewSet):
    queryset = Line.objects.select_related("zone", "zone__greenhouse", "zone__greenhouse__site").prefetch_related("devices")
    serializer_class = LineSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = (
        "name",
        "code",
        "description",
        "zone__name",
        "zone__greenhouse__name",
        "zone__greenhouse__site__name",
    )
    ordering_fields = ("name", "code", "created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "zone": "zone_id",
                "greenhouse": "zone__greenhouse_id",
                "site": "zone__greenhouse__site_id",
                "code": "code",
            },
        )


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.select_related("line", "line__zone", "line__zone__greenhouse", "line__zone__greenhouse__site")
    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticatedReadOnlyOrAdminWrite]
    search_fields = (
        "name",
        "identifier",
        "description",
        "line__name",
        "line__code",
        "line__zone__name",
        "line__zone__greenhouse__name",
        "line__zone__greenhouse__site__name",
    )
    ordering_fields = (
        "name",
        "identifier",
        "line__name",
        "line__zone__name",
        "line__zone__greenhouse__name",
        "line__zone__greenhouse__site__name",
        "created_at",
        "updated_at",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        return apply_query_filters(
            queryset,
            self.request.query_params,
            {
                "line": "line_id",
                "zone": "line__zone_id",
                "greenhouse": "line__zone__greenhouse_id",
                "site": "line__zone__greenhouse__site_id",
                "identifier": "identifier",
            },
        )

    @action(detail=False, methods=["get"], url_path="map")
    def map(self, request):
        queryset = apply_query_filters(
            super().get_queryset(),
            request.query_params,
            {
                "line": "line_id",
                "zone": "line__zone_id",
                "greenhouse": "line__zone__greenhouse_id",
                "site": "line__zone__greenhouse__site_id",
            },
        )
        location_query = (
            Q(latitude__isnull=False, longitude__isnull=False)
            | Q(local_x__isnull=False, local_y__isnull=False)
        )
        has_location = request.query_params.get("has_location")

        if isinstance(has_location, str):
            lowered = has_location.lower()
            if lowered in TRUE_VALUES:
                queryset = queryset.filter(location_query)
            elif lowered in FALSE_VALUES:
                queryset = queryset.exclude(location_query)

        queryset = queryset.order_by("name", "identifier")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = DeviceMapSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        serializer = DeviceMapSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)
