from django.contrib import admin

from apps.devices.models import Device, Greenhouse, Site, Zone


class GreenhouseInline(admin.TabularInline):
    model = Greenhouse
    extra = 0


class ZoneInline(admin.TabularInline):
    model = Zone
    extra = 0


class DeviceInline(admin.TabularInline):
    model = Device
    extra = 0


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "created_at", "updated_at")
    search_fields = ("name", "location")
    ordering = ("name",)
    inlines = (GreenhouseInline,)


@admin.register(Greenhouse)
class GreenhouseAdmin(admin.ModelAdmin):
    list_display = ("name", "site", "created_at", "updated_at")
    list_filter = ("site",)
    search_fields = ("name", "description", "site__name")
    ordering = ("site__name", "name")
    inlines = (ZoneInline,)


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "greenhouse", "created_at", "updated_at")
    list_filter = ("greenhouse", "greenhouse__site")
    search_fields = ("name", "description", "greenhouse__name", "greenhouse__site__name")
    ordering = ("greenhouse__name", "name")
    inlines = (DeviceInline,)


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("name", "identifier", "zone", "created_at", "updated_at")
    list_filter = ("zone", "zone__greenhouse", "zone__greenhouse__site")
    search_fields = (
        "name",
        "identifier",
        "description",
        "zone__name",
        "zone__greenhouse__name",
        "zone__greenhouse__site__name",
    )
    ordering = ("zone__name", "name")
