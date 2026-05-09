from rest_framework import serializers

from apps.devices.models import Device, Greenhouse, Line, Site, Zone


class DeviceSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source="line.name", read_only=True)
    zone = serializers.UUIDField(source="line.zone_id", read_only=True)
    zone_name = serializers.CharField(source="line.zone.name", read_only=True)
    greenhouse = serializers.UUIDField(source="line.zone.greenhouse_id", read_only=True)
    greenhouse_name = serializers.CharField(source="line.zone.greenhouse.name", read_only=True)
    site = serializers.UUIDField(source="line.zone.greenhouse.site_id", read_only=True)
    site_name = serializers.CharField(source="line.zone.greenhouse.site.name", read_only=True)

    class Meta:
        model = Device
        fields = (
            "id",
            "line",
            "line_name",
            "zone",
            "zone_name",
            "greenhouse",
            "greenhouse_name",
            "site",
            "site_name",
            "name",
            "identifier",
            "description",
            "latitude",
            "longitude",
            "local_x",
            "local_y",
            "map_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class DeviceMapSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source="line.name", read_only=True)
    zone = serializers.UUIDField(source="line.zone_id", read_only=True)
    zone_name = serializers.CharField(source="line.zone.name", read_only=True)
    greenhouse = serializers.UUIDField(source="line.zone.greenhouse_id", read_only=True)
    greenhouse_name = serializers.CharField(source="line.zone.greenhouse.name", read_only=True)
    site = serializers.UUIDField(source="line.zone.greenhouse.site_id", read_only=True)
    site_name = serializers.CharField(source="line.zone.greenhouse.site.name", read_only=True)
    has_location = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = (
            "id",
            "name",
            "identifier",
            "latitude",
            "longitude",
            "local_x",
            "local_y",
            "map_label",
            "line",
            "line_name",
            "zone",
            "zone_name",
            "greenhouse",
            "greenhouse_name",
            "site",
            "site_name",
            "updated_at",
            "has_location",
        )
        read_only_fields = fields

    def get_has_location(self, obj):
        has_geo_position = obj.latitude is not None and obj.longitude is not None
        has_local_position = obj.local_x is not None and obj.local_y is not None
        return has_geo_position or has_local_position


class LineSerializer(serializers.ModelSerializer):
    devices = DeviceSerializer(many=True, read_only=True)
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = Line
        fields = (
            "id",
            "zone",
            "zone_name",
            "name",
            "code",
            "description",
            "devices",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ZoneSerializer(serializers.ModelSerializer):
    lines = LineSerializer(many=True, read_only=True)
    devices = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = (
            "id",
            "greenhouse",
            "name",
            "description",
            "lines",
            "devices",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_devices(self, obj):
        devices = []
        for line in obj.lines.all():
            devices.extend(line.devices.all())
        return DeviceSerializer(devices, many=True, context=self.context).data


class GreenhouseSerializer(serializers.ModelSerializer):
    zones = ZoneSerializer(many=True, read_only=True)

    class Meta:
        model = Greenhouse
        fields = (
            "id",
            "site",
            "name",
            "description",
            "zones",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SiteSerializer(serializers.ModelSerializer):
    greenhouses = GreenhouseSerializer(many=True, read_only=True)

    class Meta:
        model = Site
        fields = (
            "id",
            "name",
            "location",
            "greenhouses",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
