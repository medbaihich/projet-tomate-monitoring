from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class Role(UUIDPrimaryKeyModel, TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class User(UUIDPrimaryKeyModel, TimeStampedModel, AbstractUser):
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
    )
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ("username",)

    def __str__(self) -> str:
        return self.get_username()
