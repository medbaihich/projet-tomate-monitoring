from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.accounts.models import Role
from apps.catalog.models import Disease
from apps.devices.models import Device, Greenhouse, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion


class Command(BaseCommand):
    help = "Seed a minimal set of demo data for local development."

    def handle(self, *args, **options):
        ai_assets_dir = Path(settings.AI_ASSETS_DIR)

        admin_role, _ = Role.objects.get_or_create(
            name="admin",
            defaults={"description": "Demo administrator role."},
        )
        operator_role, _ = Role.objects.get_or_create(
            name="operator",
            defaults={"description": "Demo operator role."},
        )

        user_model = get_user_model()
        admin_user, created = user_model.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.com",
                "first_name": "Demo",
                "last_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
                "role": admin_role,
            },
        )
        if created:
            admin_user.set_password("admin1234")
            admin_user.save(update_fields=["password"])
        else:
            updated_fields = []
            if admin_user.role_id != admin_role.id:
                admin_user.role = admin_role
                updated_fields.append("role")
            if not admin_user.is_staff:
                admin_user.is_staff = True
                updated_fields.append("is_staff")
            if not admin_user.is_superuser:
                admin_user.is_superuser = True
                updated_fields.append("is_superuser")
            if updated_fields:
                admin_user.save(update_fields=updated_fields)

        site, _ = Site.objects.get_or_create(
            name="Demo Site",
            defaults={"location": "Local Development"},
        )
        greenhouse, _ = Greenhouse.objects.get_or_create(
            site=site,
            name="Greenhouse A",
            defaults={"description": "Primary demo greenhouse."},
        )
        zone, _ = Zone.objects.get_or_create(
            greenhouse=greenhouse,
            name="Zone 1",
            defaults={"description": "Primary demo cultivation zone."},
        )
        device, _ = Device.objects.get_or_create(
            identifier="demo-device-001",
            defaults={
                "zone": zone,
                "name": "Camera Node 1",
                "description": "Demo inspection device.",
            },
        )
        if device.zone_id != zone.id or device.name != "Camera Node 1":
            device.zone = zone
            device.name = "Camera Node 1"
            device.description = "Demo inspection device."
            device.save(update_fields=["zone", "name", "description"])

        diseases = [
            {
                "name": "Early Blight",
                "summary": "A common fungal tomato disease causing dark target-like lesions.",
                "symptoms": "Brown concentric spots on older leaves and stem damage.",
                "prevention": "Rotate crops, remove infected debris, and improve airflow.",
            },
            {
                "name": "Late Blight",
                "summary": "A fast-spreading oomycete disease affecting leaves and fruit.",
                "symptoms": "Water-soaked lesions that turn dark with pale margins.",
                "prevention": "Reduce leaf wetness and apply preventive fungicide programs.",
            },
            {
                "name": "Healthy",
                "summary": "Reference entry for healthy plant tissue.",
                "symptoms": "No visible disease symptoms.",
                "prevention": "Maintain balanced irrigation and sanitation practices.",
            },
        ]
        for disease_data in diseases:
            Disease.objects.update_or_create(
                slug=slugify(disease_data["name"]),
                defaults=disease_data,
            )

        model_version, _ = ModelVersion.objects.get_or_create(
            name="Tomato Similarity Model",
            version="v1.0.0",
            defaults={
                "framework": "external",
                "artifact_path": str(ai_assets_dir / "models" / "tomato_similarity_model.bin"),
                "is_active": True,
                "notes": "Demo model metadata for local development.",
            },
        )

        InferenceIndex.objects.update_or_create(
            model_version=model_version,
            organ_type=InferenceIndex.OrganType.FRUIT,
            name="fruit-demo-index",
            defaults={
                "index_path": str(ai_assets_dir / "indexes" / "fruit.index"),
                "metadata_path": str(ai_assets_dir / "metadata" / "fruit_metadata.csv"),
                "threshold_default": 0.8,
                "top_k_default": 5,
                "is_active": True,
                "notes": "Demo fruit FAISS metadata reference.",
            },
        )
        InferenceIndex.objects.update_or_create(
            model_version=model_version,
            organ_type=InferenceIndex.OrganType.LEAF,
            name="leaf-demo-index",
            defaults={
                "index_path": str(ai_assets_dir / "indexes" / "leaf.index"),
                "metadata_path": str(ai_assets_dir / "metadata" / "final_metadata.csv"),
                "threshold_default": 0.8,
                "top_k_default": 5,
                "is_active": True,
                "notes": "Demo leaf FAISS metadata reference.",
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data is ready."))
        self.stdout.write("Roles: admin, operator")
        self.stdout.write("Admin user: admin / admin1234")
        self.stdout.write(f"Site: {site.name}")
        self.stdout.write(f"Greenhouse: {greenhouse.name}")
        self.stdout.write(f"Zone: {zone.name}")
        self.stdout.write(f"Device: {device.name} ({device.identifier})")
        self.stdout.write(f"Model version: {model_version}")
