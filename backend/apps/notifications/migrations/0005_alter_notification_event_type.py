from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0004_alter_notification_severity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("disease_alert", "Disease Alert"),
                    ("review_required", "Review Required"),
                ],
                default="disease_alert",
                max_length=50,
            ),
        ),
    ]
