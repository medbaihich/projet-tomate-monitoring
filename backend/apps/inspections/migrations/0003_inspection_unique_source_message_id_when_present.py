from django.db import migrations, models
from django.db.models import Count


def deduplicate_source_message_ids(apps, schema_editor):
    Inspection = apps.get_model("inspections", "Inspection")

    duplicate_groups = (
        Inspection.objects.exclude(source_message_id="")
        .values("source_message_id")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )

    for duplicate_group in duplicate_groups:
        source_message_id = duplicate_group["source_message_id"]
        inspections = list(
            Inspection.objects.filter(source_message_id=source_message_id).order_by(
                "created_at",
                "id",
            )
        )

        for duplicate_index, inspection in enumerate(inspections[1:], start=1):
            suffix = f"__legacy_duplicate__{duplicate_index}"
            base_value = source_message_id[: 255 - len(suffix)]
            inspection.source_message_id = f"{base_value}{suffix}"
            inspection.save(update_fields=["source_message_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("inspections", "0002_alter_inspection_confidence_score_and_more"),
    ]

    operations = [
        migrations.RunPython(
            deduplicate_source_message_ids,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="inspection",
            constraint=models.UniqueConstraint(
                condition=~models.Q(source_message_id=""),
                fields=("source_message_id",),
                name="unique_inspection_source_message_id_when_present",
            ),
        ),
    ]
