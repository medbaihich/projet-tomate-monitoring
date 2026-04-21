import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("catalog", "0001_initial"),
        ("inspections", "0002_alter_inspection_confidence_score_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "event_type",
                    models.CharField(
                        choices=[("disease_alert", "Disease Alert")],
                        default="disease_alert",
                        max_length=50,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[("medium", "Medium"), ("high", "High")],
                        default="medium",
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField()),
                ("display_disease_label", models.CharField(max_length=255)),
                ("confidence_score", models.FloatField(blank=True, null=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("is_read", models.BooleanField(default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                (
                    "disease",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notifications",
                        to="catalog.disease",
                    ),
                ),
                (
                    "inspection",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="inspections.inspection",
                    ),
                ),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                fields=("inspection", "event_type"),
                name="unique_notification_event_type_per_inspection",
            ),
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("confidence_score__isnull", True),
                    models.Q(
                        ("confidence_score__gte", 0),
                        ("confidence_score__lte", 1),
                    ),
                    _connector="OR",
                ),
                name="notification_confidence_score_between_0_and_1_or_null",
            ),
        ),
    ]
