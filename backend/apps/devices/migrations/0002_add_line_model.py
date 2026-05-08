# Generated manually for Phase 4 hierarchy migration.

import uuid

import django.db.models.deletion
from django.db import migrations, models


DEFAULT_LINE_CODE = "default"
DEFAULT_LINE_NAME = "Default Line"


def migrate_devices_to_default_lines(apps, schema_editor):
    Line = apps.get_model("devices", "Line")
    Device = apps.get_model("devices", "Device")

    for device in Device.objects.select_related("zone").all().iterator():
        line, _ = Line.objects.get_or_create(
            zone_id=device.zone_id,
            code=DEFAULT_LINE_CODE,
            defaults={
                "name": DEFAULT_LINE_NAME,
                "description": "Automatically created during the Phase 4 line hierarchy migration.",
            },
        )
        device.line_id = line.id
        device.save(update_fields=["line"])


class Migration(migrations.Migration):

    dependencies = [
        ("devices", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Line",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("code", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                (
                    "zone",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="devices.zone",
                    ),
                ),
            ],
            options={
                "ordering": ("name",),
            },
        ),
        migrations.AddConstraint(
            model_name="line",
            constraint=models.UniqueConstraint(
                fields=("zone", "name"),
                name="unique_line_name_per_zone",
            ),
        ),
        migrations.AddConstraint(
            model_name="line",
            constraint=models.UniqueConstraint(
                fields=("zone", "code"),
                name="unique_line_code_per_zone",
            ),
        ),
        migrations.AddField(
            model_name="device",
            name="line",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="devices",
                to="devices.line",
            ),
        ),
        migrations.RunPython(
            migrate_devices_to_default_lines,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="device",
            name="line",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="devices",
                to="devices.line",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="device",
            name="unique_device_name_per_zone",
        ),
        migrations.RemoveField(
            model_name="device",
            name="zone",
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.UniqueConstraint(
                fields=("line", "name"),
                name="unique_device_name_per_line",
            ),
        ),
    ]
