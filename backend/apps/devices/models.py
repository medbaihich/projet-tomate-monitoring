from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class Site(UUIDPrimaryKeyModel, TimeStampedModel):
    name = models.CharField(max_length=255, unique=True)
    location = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Greenhouse(UUIDPrimaryKeyModel, TimeStampedModel):
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="greenhouses",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("site", "name"),
                name="unique_greenhouse_name_per_site",
            )
        ]

    def __str__(self) -> str:
        return f"{self.site.name} - {self.name}"


class Zone(UUIDPrimaryKeyModel, TimeStampedModel):
    greenhouse = models.ForeignKey(
        Greenhouse,
        on_delete=models.CASCADE,
        related_name="zones",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("greenhouse", "name"),
                name="unique_zone_name_per_greenhouse",
            )
        ]

    def __str__(self) -> str:
        return f"{self.greenhouse.name} - {self.name}"


class Line(UUIDPrimaryKeyModel, TimeStampedModel):
    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("zone", "name"),
                name="unique_line_name_per_zone",
            ),
            models.UniqueConstraint(
                fields=("zone", "code"),
                name="unique_line_code_per_zone",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.zone.name} - {self.name}"


class Device(UUIDPrimaryKeyModel, TimeStampedModel):
    line = models.ForeignKey(
        Line,
        on_delete=models.CASCADE,
        related_name="devices",
    )
    name = models.CharField(max_length=255)
    identifier = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("line", "name"),
                name="unique_device_name_per_line",
            )
        ]

    def __str__(self) -> str:
        return f"{self.line.name} - {self.name}"
