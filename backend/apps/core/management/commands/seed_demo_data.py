from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import Role
from apps.catalog.models import Disease, DiseaseMapProfile
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion


DATASET_DISEASES = [
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "anthracnose",
        "name": "Anthracnose",
        "slug": "fruit-anthracnose",
        "summary": "Fruit disease class from the tomato AI dataset.",
        "symptoms": "Dark sunken fruit lesions may appear on infected tomatoes.",
        "prevention": "Use sanitation, avoid overhead splash, and remove infected plant material.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "bacterial_spot",
        "name": "Bacterial Spot",
        "slug": "fruit-bacterial-spot",
        "summary": "Fruit disease class from the tomato AI dataset.",
        "symptoms": "Small scabby spots may appear on tomato fruit.",
        "prevention": "Use clean seed/transplants, reduce leaf wetness, and follow local spray guidance.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "blossom_end_rot",
        "name": "Blossom End Rot",
        "slug": "fruit-blossom-end-rot",
        "summary": "Physiological fruit disorder class from the tomato AI dataset.",
        "symptoms": "Dark sunken tissue appears at the blossom end of fruit.",
        "prevention": "Maintain even irrigation and avoid calcium uptake stress.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "catfaced",
        "name": "Catfaced",
        "slug": "fruit-catfaced",
        "summary": "Fruit quality class from the tomato AI dataset.",
        "symptoms": "Fruit may show malformed, puckered, or scarred blossom-end tissue.",
        "prevention": "Reduce flower stress and maintain stable greenhouse conditions.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "fruit_cracking",
        "name": "Fruit Cracking",
        "slug": "fruit-fruit-cracking",
        "summary": "Fruit quality class from the tomato AI dataset.",
        "symptoms": "Radial or concentric cracks may form on ripening fruit.",
        "prevention": "Maintain consistent irrigation and avoid rapid water availability swings.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "healthy",
        "name": "Healthy",
        "slug": "fruit-healthy",
        "summary": "Reference entry for healthy tomato fruit.",
        "symptoms": "No visible disease symptoms.",
        "prevention": "Maintain balanced irrigation, nutrition, and sanitation practices.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "late_blight",
        "name": "Late Blight",
        "slug": "fruit-late-blight",
        "summary": "Fruit disease class from the tomato AI dataset.",
        "symptoms": "Firm brown lesions may develop on tomato fruit.",
        "prevention": "Reduce leaf wetness and apply preventive fungicide programs when advised.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "mold",
        "name": "Mold",
        "slug": "fruit-mold",
        "summary": "Fruit mold class from the tomato AI dataset.",
        "symptoms": "Mold growth or decay may appear on fruit surfaces.",
        "prevention": "Improve airflow, remove decaying fruit, and reduce excess humidity.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "spotted_wilt_virus",
        "name": "Spotted Wilt Virus",
        "slug": "fruit-spotted-wilt-virus",
        "summary": "Fruit disease class from the tomato AI dataset.",
        "symptoms": "Fruit may show ringspots, blotches, or uneven ripening.",
        "prevention": "Monitor thrips pressure and remove infected plants when appropriate.",
    },
    {
        "organ_type": Disease.OrganType.FRUIT,
        "ai_label": "target_spot",
        "name": "Target Spot",
        "slug": "fruit-target-spot",
        "summary": "Fruit disease class from the tomato AI dataset.",
        "symptoms": "Target-like lesions may appear on fruit or nearby tissue.",
        "prevention": "Improve airflow, remove infected residue, and follow local disease guidance.",
    },
    {
        "organ_type": Disease.OrganType.LEAF,
        "ai_label": "bushy_stunt",
        "name": "Bushy Stunt",
        "slug": "leaf-bushy-stunt",
        "summary": "Leaf disease class from the tomato AI dataset.",
        "symptoms": "Plants may appear stunted with distorted foliage.",
        "prevention": "Use sanitation and remove infected plant material when confirmed.",
    },
    {
        "organ_type": Disease.OrganType.LEAF,
        "ai_label": "early_blight",
        "name": "Early Blight",
        "slug": "leaf-early-blight",
        "summary": "A common fungal tomato disease causing dark target-like lesions.",
        "symptoms": "Brown concentric spots on older leaves and stem damage.",
        "prevention": "Rotate crops, remove infected debris, and improve airflow.",
    },
    {
        "organ_type": Disease.OrganType.LEAF,
        "ai_label": "healthy",
        "name": "Healthy",
        "slug": "leaf-healthy",
        "summary": "Reference entry for healthy tomato leaves.",
        "symptoms": "No visible disease symptoms.",
        "prevention": "Maintain balanced irrigation and sanitation practices.",
    },
    {
        "organ_type": Disease.OrganType.LEAF,
        "ai_label": "late_blight",
        "name": "Late Blight",
        "slug": "leaf-late-blight",
        "summary": "A fast-spreading oomycete disease affecting leaves and fruit.",
        "symptoms": "Water-soaked lesions that turn dark with pale margins.",
        "prevention": "Reduce leaf wetness and apply preventive fungicide programs.",
    },
    {
        "organ_type": Disease.OrganType.LEAF,
        "ai_label": "leaf_curl",
        "name": "Leaf Curl",
        "slug": "leaf-leaf-curl",
        "summary": "Leaf disease class from the tomato AI dataset.",
        "symptoms": "Leaves may curl, yellow, or show distorted growth.",
        "prevention": "Monitor vector pressure and remove infected plants when appropriate.",
    },
]

DEFAULT_DISEASE_MAP_PROFILE_SOURCE_NOTES = (
    "Default visualization/risk guidance for map use; radius is an approximate "
    "operational hint, not an exact scientific spread distance."
)

DATASET_DISEASE_MAP_PROFILES = {
    (Disease.OrganType.FRUIT, "anthracnose"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.FUNGAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.SPLASH,
        "zone_type": DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        "spread_radius_m": 4,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Anthracnose risk",
        "short_map_description": "Fungal disease favored by humidity and splash dispersal.",
    },
    (Disease.OrganType.FRUIT, "bacterial_spot"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.BACTERIAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.SPLASH,
        "zone_type": DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        "spread_radius_m": 3,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Bacterial spot risk",
        "short_map_description": (
            "Bacterial disease that may spread through water splash and contaminated material."
        ),
    },
    (Disease.OrganType.FRUIT, "blossom_end_rot"): {
        "is_infectious": False,
        "spread_category": DiseaseMapProfile.SpreadCategory.PHYSIOLOGICAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.NUTRIENT_WATER_IMBALANCE,
        "zone_type": DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
        "spread_radius_m": 2,
        "risk_level": DiseaseMapProfile.RiskLevel.MEDIUM,
        "map_label": "Calcium/water stress risk",
        "short_map_description": (
            "Non-contagious physiological disorder linked to calcium transport and watering irregularity."
        ),
    },
    (Disease.OrganType.FRUIT, "catfaced"): {
        "is_infectious": False,
        "spread_category": DiseaseMapProfile.SpreadCategory.PHYSIOLOGICAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.DEVELOPMENT_DISORDER,
        "zone_type": DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
        "spread_radius_m": 1.5,
        "risk_level": DiseaseMapProfile.RiskLevel.LOW,
        "map_label": "Development disorder",
        "short_map_description": (
            "Non-contagious fruit deformation linked to developmental or environmental stress."
        ),
    },
    (Disease.OrganType.FRUIT, "fruit_cracking"): {
        "is_infectious": False,
        "spread_category": DiseaseMapProfile.SpreadCategory.PHYSIOLOGICAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.WATER_STRESS,
        "zone_type": DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
        "spread_radius_m": 2,
        "risk_level": DiseaseMapProfile.RiskLevel.MEDIUM,
        "map_label": "Water stress risk",
        "short_map_description": (
            "Non-contagious fruit cracking often linked to irregular watering or humidity changes."
        ),
    },
    (Disease.OrganType.FRUIT, "healthy"): {
        "is_infectious": False,
        "spread_category": DiseaseMapProfile.SpreadCategory.NONE,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.NONE,
        "zone_type": DiseaseMapProfile.ZoneType.NONE,
        "spread_radius_m": 0,
        "risk_level": DiseaseMapProfile.RiskLevel.LOW,
        "map_label": "Healthy",
        "short_map_description": "No disease symptoms detected.",
    },
    (Disease.OrganType.FRUIT, "late_blight"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.OOMYCETE,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.AIRBORNE,
        "zone_type": DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        "spread_radius_m": 8,
        "risk_level": DiseaseMapProfile.RiskLevel.CRITICAL,
        "map_label": "Late blight high-risk zone",
        "short_map_description": (
            "Highly destructive disease favored by humidity and capable of fast spread."
        ),
    },
    (Disease.OrganType.FRUIT, "mold"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.FUNGAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.HUMIDITY_RELATED,
        "zone_type": DiseaseMapProfile.ZoneType.RISK_ZONE,
        "spread_radius_m": 3,
        "risk_level": DiseaseMapProfile.RiskLevel.MEDIUM,
        "map_label": "Mold risk",
        "short_map_description": "Fungal or rot risk associated with humidity and infected tissue.",
    },
    (Disease.OrganType.FRUIT, "spotted_wilt_virus"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.VIRAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.VECTOR_THRIPS,
        "zone_type": DiseaseMapProfile.ZoneType.VECTOR_RISK_ZONE,
        "spread_radius_m": 5,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Thrips vector risk",
        "short_map_description": (
            "Viral disease associated with thrips vectors; nearby plants and vector pressure "
            "should be monitored."
        ),
    },
    (Disease.OrganType.FRUIT, "target_spot"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.FUNGAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.HUMIDITY_RELATED,
        "zone_type": DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        "spread_radius_m": 4,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Target spot risk",
        "short_map_description": "Fungal disease favored by warm, humid conditions.",
    },
    (Disease.OrganType.LEAF, "bushy_stunt"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.VIRAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.UNKNOWN,
        "zone_type": DiseaseMapProfile.ZoneType.VECTOR_RISK_ZONE,
        "spread_radius_m": 4,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Viral stunt risk",
        "short_map_description": (
            "Viral-like disease profile; inspect nearby plants and possible vectors."
        ),
    },
    (Disease.OrganType.LEAF, "early_blight"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.FUNGAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.SPLASH,
        "zone_type": DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        "spread_radius_m": 4,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Early blight risk",
        "short_map_description": (
            "Fungal disease that can spread through spores and plant debris, favored by humidity."
        ),
    },
    (Disease.OrganType.LEAF, "healthy"): {
        "is_infectious": False,
        "spread_category": DiseaseMapProfile.SpreadCategory.NONE,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.NONE,
        "zone_type": DiseaseMapProfile.ZoneType.NONE,
        "spread_radius_m": 0,
        "risk_level": DiseaseMapProfile.RiskLevel.LOW,
        "map_label": "Healthy",
        "short_map_description": "No disease symptoms detected.",
    },
    (Disease.OrganType.LEAF, "late_blight"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.OOMYCETE,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.AIRBORNE,
        "zone_type": DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        "spread_radius_m": 8,
        "risk_level": DiseaseMapProfile.RiskLevel.CRITICAL,
        "map_label": "Late blight high-risk zone",
        "short_map_description": (
            "Highly destructive disease favored by humidity and capable of fast spread."
        ),
    },
    (Disease.OrganType.LEAF, "leaf_curl"): {
        "is_infectious": True,
        "spread_category": DiseaseMapProfile.SpreadCategory.VIRAL,
        "transmission_mode": DiseaseMapProfile.TransmissionMode.VECTOR_WHITEFLY,
        "zone_type": DiseaseMapProfile.ZoneType.VECTOR_RISK_ZONE,
        "spread_radius_m": 5,
        "risk_level": DiseaseMapProfile.RiskLevel.HIGH,
        "map_label": "Whitefly vector risk",
        "short_map_description": (
            "Viral leaf curl profile associated with whitefly vector pressure."
        ),
    },
}


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
        line, _ = Line.objects.get_or_create(
            zone=zone,
            code="default",
            defaults={
                "name": "Default Line",
                "description": "Primary demo line.",
            },
        )
        device, _ = Device.objects.get_or_create(
            identifier="demo-device-001",
            defaults={
                "line": line,
                "name": "Camera Node 1",
                "description": "Demo inspection device.",
            },
        )
        if device.line_id != line.id or device.name != "Camera Node 1":
            device.line = line
            device.name = "Camera Node 1"
            device.description = "Demo inspection device."
            device.save(update_fields=["line", "name", "description"])

        for disease_data in DATASET_DISEASES:
            disease, _ = Disease.objects.update_or_create(
                organ_type=disease_data["organ_type"],
                ai_label=disease_data["ai_label"],
                defaults=disease_data,
            )
            profile_defaults = DATASET_DISEASE_MAP_PROFILES[
                (disease_data["organ_type"], disease_data["ai_label"])
            ]
            DiseaseMapProfile.objects.get_or_create(
                disease=disease,
                defaults={
                    **profile_defaults,
                    "source_notes": DEFAULT_DISEASE_MAP_PROFILE_SOURCE_NOTES,
                },
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
        self.stdout.write(f"Line: {line.name} ({line.code})")
        self.stdout.write(f"Device: {device.name} ({device.identifier})")
        self.stdout.write(f"Model version: {model_version}")
