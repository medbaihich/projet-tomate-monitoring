from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.catalog.models import Disease
from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel
from apps.inspections.models import Inspection


class Notification(UUIDPrimaryKeyModel, TimeStampedModel):
    class EventType(models.TextChoices):
        DISEASE_ALERT = "disease_alert", "Disease Alert"

    class Severity(models.TextChoices):
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    disease = models.ForeignKey(
        Disease,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        default=EventType.DISEASE_ALERT,
    )
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    display_disease_label = models.CharField(max_length=255)
    confidence_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
    )
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("inspection", "event_type"),
                name="unique_notification_event_type_per_inspection",
            ),
            models.CheckConstraint(
                condition=models.Q(confidence_score__isnull=True)
                | (
                    models.Q(confidence_score__gte=0)
                    & models.Q(confidence_score__lte=1)
                ),
                name="notification_confidence_score_between_0_and_1_or_null",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} - {self.display_disease_label}"


class NotificationUserState(UUIDPrimaryKeyModel, TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_states",
    )
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="user_states",
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("user", "notification"),
                name="unique_notification_state_per_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} - {self.notification_id} - read={self.is_read}"

