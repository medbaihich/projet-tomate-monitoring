from django.db import migrations, models


DATASET_DISEASES = [
    ("fruit", "anthracnose", "Anthracnose", "fruit-anthracnose"),
    ("fruit", "bacterial_spot", "Bacterial Spot", "fruit-bacterial-spot"),
    ("fruit", "blossom_end_rot", "Blossom End Rot", "fruit-blossom-end-rot"),
    ("fruit", "catfaced", "Catfaced", "fruit-catfaced"),
    ("fruit", "fruit_cracking", "Fruit Cracking", "fruit-fruit-cracking"),
    ("fruit", "healthy", "Healthy", "fruit-healthy"),
    ("fruit", "late_blight", "Late Blight", "fruit-late-blight"),
    ("fruit", "mold", "Mold", "fruit-mold"),
    ("fruit", "spotted_wilt_virus", "Spotted Wilt Virus", "fruit-spotted-wilt-virus"),
    ("fruit", "target_spot", "Target Spot", "fruit-target-spot"),
    ("leaf", "bushy_stunt", "Bushy Stunt", "leaf-bushy-stunt"),
    ("leaf", "early_blight", "Early Blight", "leaf-early-blight"),
    ("leaf", "healthy", "Healthy", "leaf-healthy"),
    ("leaf", "late_blight", "Late Blight", "leaf-late-blight"),
    ("leaf", "leaf_curl", "Leaf Curl", "leaf-leaf-curl"),
]

LEGACY_DEFAULTS = {
    "anthracnose": "fruit",
    "bacterial_spot": "fruit",
    "blossom_end_rot": "fruit",
    "catfaced": "fruit",
    "fruit_cracking": "fruit",
    "healthy": "fruit",
    "late_blight": "leaf",
    "mold": "fruit",
    "spotted_wilt_virus": "fruit",
    "target_spot": "fruit",
    "bushy_stunt": "leaf",
    "early_blight": "leaf",
    "leaf_curl": "leaf",
}

SUMMARIES = {
    ("fruit", "healthy"): {
        "summary": "Reference entry for healthy tomato fruit.",
        "symptoms": "No visible disease symptoms.",
        "prevention": "Maintain balanced irrigation, nutrition, and sanitation practices.",
    },
    ("leaf", "healthy"): {
        "summary": "Reference entry for healthy tomato leaves.",
        "symptoms": "No visible disease symptoms.",
        "prevention": "Maintain balanced irrigation and sanitation practices.",
    },
    ("leaf", "early_blight"): {
        "summary": "A common fungal tomato disease causing dark target-like lesions.",
        "symptoms": "Brown concentric spots on older leaves and stem damage.",
        "prevention": "Rotate crops, remove infected debris, and improve airflow.",
    },
    ("leaf", "late_blight"): {
        "summary": "A fast-spreading oomycete disease affecting leaves and fruit.",
        "symptoms": "Water-soaked lesions that turn dark with pale margins.",
        "prevention": "Reduce leaf wetness and apply preventive fungicide programs.",
    },
}


def normalize_ai_label(value):
    import re

    normalized = re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())
    return normalized.strip("_")


def find_seed(organ_type, ai_label):
    for seed_organ_type, seed_ai_label, name, slug in DATASET_DISEASES:
        if seed_organ_type == organ_type and seed_ai_label == ai_label:
            return {
                "organ_type": seed_organ_type,
                "ai_label": seed_ai_label,
                "name": name,
                "slug": slug,
                **SUMMARIES.get((seed_organ_type, seed_ai_label), {}),
            }
    return None


def infer_referenced_organ_type(apps, disease):
    Inspection = apps.get_model("inspections", "Inspection")
    InspectionMatch = apps.get_model("inspections", "InspectionMatch")

    organ_types = set(
        Inspection.objects.filter(predicted_disease_id=disease.pk)
        .exclude(organ_type="")
        .values_list("organ_type", flat=True)
        .distinct()
    )
    organ_types.update(
        InspectionMatch.objects.filter(disease_id=disease.pk)
        .exclude(inspection__organ_type="")
        .values_list("inspection__organ_type", flat=True)
        .distinct()
    )

    return organ_types.pop() if len(organ_types) == 1 else None


def backfill_and_seed_diseases(apps, schema_editor):
    Disease = apps.get_model("catalog", "Disease")

    for disease in Disease.objects.all().order_by("created_at", "id"):
        legacy_label = normalize_ai_label(disease.slug or disease.name)
        referenced_organ_type = infer_referenced_organ_type(apps, disease)
        organ_type = referenced_organ_type or LEGACY_DEFAULTS.get(legacy_label, "fruit")
        seed = find_seed(organ_type, legacy_label)

        disease.organ_type = organ_type
        disease.ai_label = legacy_label
        if seed:
            disease.name = seed["name"]
            disease.slug = seed["slug"]
            if not disease.summary:
                disease.summary = seed.get("summary", "")
            if not disease.symptoms:
                disease.symptoms = seed.get("symptoms", "")
            if not disease.prevention:
                disease.prevention = seed.get("prevention", "")
        else:
            disease.slug = f"{organ_type}-{disease.slug}"

        disease.save()

    for organ_type, ai_label, name, slug in DATASET_DISEASES:
        defaults = {
            "name": name,
            "slug": slug,
            "summary": SUMMARIES.get((organ_type, ai_label), {}).get(
                "summary",
                f"{name} {organ_type} class from the tomato AI dataset.",
            ),
            "symptoms": SUMMARIES.get((organ_type, ai_label), {}).get("symptoms", ""),
            "prevention": SUMMARIES.get((organ_type, ai_label), {}).get("prevention", ""),
        }
        disease = Disease.objects.filter(organ_type=organ_type, ai_label=ai_label).first()
        if disease is None:
            Disease.objects.create(
                organ_type=organ_type,
                ai_label=ai_label,
                **defaults,
            )
        else:
            for field_name, value in defaults.items():
                setattr(disease, field_name, value)
            disease.save()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
        ("inspections", "0002_alter_inspection_confidence_score_and_more"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="disease",
            options={"ordering": ("organ_type", "name")},
        ),
        migrations.AddField(
            model_name="disease",
            name="ai_label",
            field=models.CharField(blank=True, db_index=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="disease",
            name="organ_type",
            field=models.CharField(
                blank=True,
                choices=[("fruit", "Fruit"), ("leaf", "Leaf")],
                db_index=True,
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="disease",
            name="name",
            field=models.CharField(max_length=255),
        ),
        migrations.RunPython(backfill_and_seed_diseases, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="disease",
            name="ai_label",
            field=models.CharField(db_index=True, max_length=120),
        ),
        migrations.AlterField(
            model_name="disease",
            name="organ_type",
            field=models.CharField(
                choices=[("fruit", "Fruit"), ("leaf", "Leaf")],
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name="disease",
            constraint=models.UniqueConstraint(
                fields=("organ_type", "ai_label"),
                name="unique_disease_ai_label_per_organ_type",
            ),
        ),
    ]
