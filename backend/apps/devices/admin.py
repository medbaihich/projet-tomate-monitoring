from django.contrib import admin

from apps.devices.models import Device, Greenhouse, Line, Site, Zone


class GreenhouseInline(admin.TabularInline):
    model = Greenhouse
    extra = 0


class ZoneInline(admin.TabularInline):
    model = Zone
    extra = 0


class DeviceInline(admin.TabularInline):
    model = Device
    extra = 0


class LineInline(admin.TabularInline):
    model = Line
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
    inlines = (LineInline,)


@admin.register(Line)
class LineAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "zone", "greenhouse_name", "site_name", "created_at", "updated_at")
    list_filter = ("zone", "zone__greenhouse", "zone__greenhouse__site")
    search_fields = (
        "name",
        "code",
        "description",
        "zone__name",
        "zone__greenhouse__name",
        "zone__greenhouse__site__name",
    )
    ordering = ("zone__name", "name")
    inlines = (DeviceInline,)

    @admin.display(description="Greenhouse", ordering="zone__greenhouse__name")
    def greenhouse_name(self, obj):
        return obj.zone.greenhouse.name

    @admin.display(description="Site", ordering="zone__greenhouse__site__name")
    def site_name(self, obj):
        return obj.zone.greenhouse.site.name


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("name", "identifier", "line", "zone_name", "greenhouse_name", "site_name", "created_at", "updated_at")
    list_filter = ("line", "line__zone", "line__zone__greenhouse", "line__zone__greenhouse__site")
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
    ordering = ("line__zone__name", "line__name", "name")

    @admin.display(description="Zone", ordering="line__zone__name")
    def zone_name(self, obj):
        return obj.line.zone.name

    @admin.display(description="Greenhouse", ordering="line__zone__greenhouse__name")
    def greenhouse_name(self, obj):
        return obj.line.zone.greenhouse.name

    @admin.display(description="Site", ordering="line__zone__greenhouse__site__name")
    def site_name(self, obj):
        return obj.line.zone.greenhouse.site.name
