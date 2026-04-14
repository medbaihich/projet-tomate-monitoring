from rest_framework import serializers

from apps.devices.models import Device, Greenhouse, Site, Zone


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = (
            "id",
            "zone",
            "name",
            "identifier",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ZoneSerializer(serializers.ModelSerializer):
    devices = DeviceSerializer(many=True, read_only=True)

    class Meta:
        model = Zone
        fields = (
            "id",
            "greenhouse",
            "name",
            "description",
            "devices",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


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
