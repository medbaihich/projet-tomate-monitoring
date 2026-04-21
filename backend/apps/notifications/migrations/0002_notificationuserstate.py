import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificationUserState",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_read", models.BooleanField(default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                (
                    "notification",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_states",
                        to="notifications.notification",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_states",
                        to="accounts.user",
                    ),
                ),
            ],
            options={"ordering": ("-updated_at",)},
        ),
        migrations.AddConstraint(
            model_name="notificationuserstate",
            constraint=models.UniqueConstraint(
                fields=("user", "notification"),
                name="unique_notification_state_per_user",
            ),
        ),
    ]
