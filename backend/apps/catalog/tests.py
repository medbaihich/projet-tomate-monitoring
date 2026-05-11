from io import StringIO

from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.catalog.models import Disease, DiseaseMapProfile


class DiseaseIdentityTests(TestCase):
    def test_disease_requires_organ_type_and_ai_label(self):
        disease = Disease.objects.create(
            name="Custom Leaf Signal",
            slug="leaf-custom-leaf-signal",
            organ_type=Disease.OrganType.LEAF,
            ai_label="custom leaf signal",
        )

        self.assertEqual(disease.organ_type, Disease.OrganType.LEAF)
        self.assertEqual(disease.ai_label, "custom_leaf_signal")

    def test_same_ai_label_can_exist_across_organs(self):
        fruit = Disease.objects.create(
            name="Shared Test Label",
            slug="fruit-shared-test-label",
            organ_type=Disease.OrganType.FRUIT,
            ai_label="shared_test_label",
        )
        leaf = Disease.objects.create(
            name="Shared Test Label",
            slug="leaf-shared-test-label",
            organ_type=Disease.OrganType.LEAF,
            ai_label="shared_test_label",
        )

        self.assertNotEqual(fruit.id, leaf.id)

    def test_duplicate_ai_label_within_same_organ_is_rejected(self):
        Disease.objects.create(
            name="Duplicate Test Label",
            slug="fruit-duplicate-test-label",
            organ_type=Disease.OrganType.FRUIT,
            ai_label="duplicate_test_label",
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Disease.objects.create(
                    name="Healthy Duplicate",
                    slug="fruit-duplicate-test-label-copy",
                    organ_type=Disease.OrganType.FRUIT,
                    ai_label="duplicate_test_label",
                )


class DiseaseSeedTests(TestCase):
    expected_dataset_records = {
        ("fruit", "anthracnose"),
        ("fruit", "bacterial_spot"),
        ("fruit", "blossom_end_rot"),
        ("fruit", "catfaced"),
        ("fruit", "fruit_cracking"),
        ("fruit", "healthy"),
        ("fruit", "late_blight"),
        ("fruit", "mold"),
        ("fruit", "spotted_wilt_virus"),
        ("fruit", "target_spot"),
        ("leaf", "bushy_stunt"),
        ("leaf", "early_blight"),
        ("leaf", "healthy"),
        ("leaf", "late_blight"),
        ("leaf", "leaf_curl"),
    }

    def get_seeded_profile(self, organ_type, ai_label):
        return DiseaseMapProfile.objects.get(
            disease__organ_type=organ_type,
            disease__ai_label=ai_label,
        )

    def run_seed(self):
        call_command("seed_demo_data", stdout=StringIO())

    def test_seed_creates_all_dataset_disease_records(self):
        self.run_seed()

        actual_records = set(Disease.objects.values_list("organ_type", "ai_label"))

        self.assertTrue(self.expected_dataset_records.issubset(actual_records))
        self.assertEqual(
            Disease.objects.filter(organ_type=Disease.OrganType.FRUIT).count(),
            10,
        )
        self.assertEqual(
            Disease.objects.filter(organ_type=Disease.OrganType.LEAF).count(),
            5,
        )

    def test_seed_is_idempotent(self):
        self.run_seed()
        first_count = Disease.objects.count()
        first_profile_count = DiseaseMapProfile.objects.count()

        self.run_seed()

        self.assertEqual(Disease.objects.count(), first_count)
        self.assertEqual(DiseaseMapProfile.objects.count(), first_profile_count)

    def test_seed_creates_map_profile_for_every_dataset_disease(self):
        self.run_seed()

        actual_profile_records = set(
            DiseaseMapProfile.objects.values_list("disease__organ_type", "disease__ai_label")
        )

        self.assertEqual(DiseaseMapProfile.objects.count(), 15)
        self.assertEqual(actual_profile_records, self.expected_dataset_records)

    def test_seed_does_not_overwrite_existing_map_profiles(self):
        disease = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="anthracnose",
        )
        DiseaseMapProfile.objects.create(
            disease=disease,
            map_label="Manual anthracnose label",
            spread_radius_m=99,
        )

        self.run_seed()

        profile = DiseaseMapProfile.objects.get(disease=disease)
        self.assertEqual(DiseaseMapProfile.objects.count(), 15)
        self.assertEqual(profile.map_label, "Manual anthracnose label")
        self.assertEqual(profile.spread_radius_m, 99)

    def test_seeded_healthy_profiles_have_no_zone(self):
        self.run_seed()

        for organ_type in (Disease.OrganType.FRUIT, Disease.OrganType.LEAF):
            profile = self.get_seeded_profile(organ_type, "healthy")
            self.assertFalse(profile.is_infectious)
            self.assertEqual(profile.spread_category, DiseaseMapProfile.SpreadCategory.NONE)
            self.assertEqual(profile.transmission_mode, DiseaseMapProfile.TransmissionMode.NONE)
            self.assertEqual(profile.zone_type, DiseaseMapProfile.ZoneType.NONE)
            self.assertEqual(profile.spread_radius_m, 0)
            self.assertEqual(profile.risk_level, DiseaseMapProfile.RiskLevel.LOW)

    def test_seeded_blossom_end_rot_is_agronomic_risk_zone(self):
        self.run_seed()

        profile = self.get_seeded_profile(Disease.OrganType.FRUIT, "blossom_end_rot")

        self.assertFalse(profile.is_infectious)
        self.assertEqual(
            profile.spread_category,
            DiseaseMapProfile.SpreadCategory.PHYSIOLOGICAL,
        )
        self.assertEqual(
            profile.transmission_mode,
            DiseaseMapProfile.TransmissionMode.NUTRIENT_WATER_IMBALANCE,
        )
        self.assertEqual(profile.zone_type, DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE)
        self.assertEqual(profile.risk_level, DiseaseMapProfile.RiskLevel.MEDIUM)

    def test_seeded_viral_vector_diseases_use_vector_risk_zone(self):
        self.run_seed()

        expected_vector_profiles = (
            (Disease.OrganType.FRUIT, "spotted_wilt_virus"),
            (Disease.OrganType.LEAF, "bushy_stunt"),
            (Disease.OrganType.LEAF, "leaf_curl"),
        )

        for organ_type, ai_label in expected_vector_profiles:
            profile = self.get_seeded_profile(organ_type, ai_label)
            self.assertTrue(profile.is_infectious)
            self.assertEqual(profile.spread_category, DiseaseMapProfile.SpreadCategory.VIRAL)
            self.assertEqual(profile.zone_type, DiseaseMapProfile.ZoneType.VECTOR_RISK_ZONE)
            self.assertEqual(profile.risk_level, DiseaseMapProfile.RiskLevel.HIGH)

    def test_seeded_late_blight_profiles_are_critical_infection_zones(self):
        self.run_seed()

        for organ_type in (Disease.OrganType.FRUIT, Disease.OrganType.LEAF):
            profile = self.get_seeded_profile(organ_type, "late_blight")
            self.assertTrue(profile.is_infectious)
            self.assertEqual(profile.spread_category, DiseaseMapProfile.SpreadCategory.OOMYCETE)
            self.assertEqual(profile.transmission_mode, DiseaseMapProfile.TransmissionMode.AIRBORNE)
            self.assertEqual(profile.zone_type, DiseaseMapProfile.ZoneType.INFECTION_ZONE)
            self.assertEqual(profile.spread_radius_m, 8)
            self.assertEqual(profile.risk_level, DiseaseMapProfile.RiskLevel.CRITICAL)


class DiseaseMapProfileModelTests(TestCase):
    def setUp(self):
        self.healthy = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="healthy",
        )
        self.late_blight = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="late_blight",
        )
        self.blossom_end_rot = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="blossom_end_rot",
        )

    def test_profile_can_be_created_for_disease(self):
        profile = DiseaseMapProfile.objects.create(
            disease=self.late_blight,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.OOMYCETE,
            transmission_mode=DiseaseMapProfile.TransmissionMode.AIRBORNE,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=75,
            risk_level=DiseaseMapProfile.RiskLevel.HIGH,
            map_color="#ef4444",
            map_label="Late blight risk",
        )

        self.assertEqual(profile.disease, self.late_blight)
        self.assertEqual(self.late_blight.map_profile, profile)

    def test_one_disease_cannot_have_duplicate_profiles(self):
        DiseaseMapProfile.objects.create(disease=self.healthy)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                DiseaseMapProfile.objects.create(disease=self.healthy)

    def test_negative_spread_radius_is_invalid(self):
        profile = DiseaseMapProfile(
            disease=self.late_blight,
            spread_radius_m=-1,
        )

        with self.assertRaises(ValidationError):
            profile.full_clean()

    def test_healthy_no_zone_profile_is_valid(self):
        profile = DiseaseMapProfile(
            disease=self.healthy,
            is_infectious=False,
            spread_category=DiseaseMapProfile.SpreadCategory.NONE,
            transmission_mode=DiseaseMapProfile.TransmissionMode.NONE,
            zone_type=DiseaseMapProfile.ZoneType.NONE,
            spread_radius_m=0,
            risk_level=DiseaseMapProfile.RiskLevel.LOW,
        )

        profile.full_clean()

    def test_infectious_infection_zone_profile_is_valid(self):
        profile = DiseaseMapProfile(
            disease=self.late_blight,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.OOMYCETE,
            transmission_mode=DiseaseMapProfile.TransmissionMode.AIRBORNE,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=100,
            risk_level=DiseaseMapProfile.RiskLevel.HIGH,
        )

        profile.full_clean()

    def test_non_infectious_agronomic_risk_zone_profile_is_valid(self):
        profile = DiseaseMapProfile(
            disease=self.blossom_end_rot,
            is_infectious=False,
            spread_category=DiseaseMapProfile.SpreadCategory.PHYSIOLOGICAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.NUTRIENT_WATER_IMBALANCE,
            zone_type=DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
            spread_radius_m=20,
            risk_level=DiseaseMapProfile.RiskLevel.MEDIUM,
        )

        profile.full_clean()


class CatalogRolePermissionTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="admin", description="Admin role")
        self.operator_role = Role.objects.create(name="operator", description="Operator role")
        self.admin_user = User.objects.create_user(
            username="catalog-admin",
            password="admin1234",
            role=self.admin_role,
        )
        self.operator_user = User.objects.create_user(
            username="catalog-operator",
            password="operator1234",
            role=self.operator_role,
        )
        self.disease = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="early_blight",
        )
        self.profile_disease = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="anthracnose",
        )

    def test_operator_can_read_disease_list(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("disease-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 15)

    def test_operator_cannot_create_disease(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.post(
            reverse("disease-list"),
            {
                "name": "Unauthorized Test Disease",
                "slug": "leaf-unauthorized-test-disease",
                "organ_type": Disease.OrganType.LEAF,
                "ai_label": "unauthorized_test_disease",
                "summary": "Fast-spreading disease.",
                "symptoms": "",
                "prevention": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_disease(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("disease-list"),
            {
                "name": "Catalog Test Disease",
                "slug": "leaf-catalog-test-disease",
                "organ_type": Disease.OrganType.LEAF,
                "ai_label": "catalog_test_disease",
                "summary": "Fast-spreading disease.",
                "symptoms": "",
                "prevention": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["organ_type"], Disease.OrganType.LEAF)
        self.assertEqual(response.data["ai_label"], "catalog_test_disease")
        self.assertTrue(Disease.objects.filter(slug="leaf-catalog-test-disease").exists())

    def test_catalog_api_exposes_organ_type_and_ai_label(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("disease-list"), {"ai_label": "early_blight"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        disease = response.data["results"][0]
        self.assertEqual(disease["organ_type"], Disease.OrganType.LEAF)
        self.assertEqual(disease["ai_label"], "early_blight")

    def test_catalog_create_requires_valid_organ_type_and_ai_label(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("disease-list"),
            {
                "name": "Broken Disease",
                "slug": "broken-disease",
                "summary": "",
                "symptoms": "",
                "prevention": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organ_type", response.data)
        self.assertIn("ai_label", response.data)

    def test_operator_can_read_disease_map_profile_list_and_detail(self):
        self.client.force_authenticate(user=self.operator_user)
        profile = DiseaseMapProfile.objects.create(
            disease=self.profile_disease,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.FUNGAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.SPLASH,
            zone_type=DiseaseMapProfile.ZoneType.RISK_ZONE,
            spread_radius_m=25,
            risk_level=DiseaseMapProfile.RiskLevel.MEDIUM,
        )

        list_response = self.client.get(reverse("disease-map-profile-list"))
        detail_response = self.client.get(reverse("disease-map-profile-detail", args=[profile.id]))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(str(detail_response.data["disease"]), str(self.profile_disease.id))
        self.assertEqual(detail_response.data["disease_ai_label"], "anthracnose")

    def test_operator_cannot_create_disease_map_profile(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.post(
            reverse("disease-map-profile-list"),
            {
                "disease": str(self.profile_disease.id),
                "is_infectious": True,
                "spread_category": DiseaseMapProfile.SpreadCategory.FUNGAL,
                "transmission_mode": DiseaseMapProfile.TransmissionMode.SPLASH,
                "zone_type": DiseaseMapProfile.ZoneType.RISK_ZONE,
                "spread_radius_m": 30,
                "risk_level": DiseaseMapProfile.RiskLevel.MEDIUM,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_disease_map_profile(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("disease-map-profile-list"),
            {
                "disease": str(self.profile_disease.id),
                "is_infectious": True,
                "spread_category": DiseaseMapProfile.SpreadCategory.FUNGAL,
                "transmission_mode": DiseaseMapProfile.TransmissionMode.SPLASH,
                "zone_type": DiseaseMapProfile.ZoneType.RISK_ZONE,
                "spread_radius_m": 30,
                "risk_level": DiseaseMapProfile.RiskLevel.MEDIUM,
                "map_label": "Anthracnose watch",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data["disease"]), str(self.profile_disease.id))
        self.assertEqual(response.data["map_label"], "Anthracnose watch")

    def test_disease_serializer_exposes_nested_map_profile(self):
        self.client.force_authenticate(user=self.operator_user)
        profile = DiseaseMapProfile.objects.create(
            disease=self.disease,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.FUNGAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.SPLASH,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=35,
            risk_level=DiseaseMapProfile.RiskLevel.MEDIUM,
        )

        response = self.client.get(reverse("disease-detail", args=[self.disease.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["map_profile"]["id"], str(profile.id))
        self.assertEqual(response.data["map_profile"]["spread_radius_m"], 35)

