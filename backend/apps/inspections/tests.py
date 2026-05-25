from datetime import timedelta
import hashlib
import tempfile

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Disease, DiseaseMapProfile
from apps.core.management.commands.seed_demo_data import Command as SeedDemoDataCommand
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inspections.models import EvidenceImageRequest, Inspection, InspectionEvidenceImage
from apps.inspections.serializers import InspectionCreateSerializer
from apps.inspections.services import (
    create_inspection_with_matches,
    ingest_ai_result_payload,
    maybe_create_evidence_image_request_for_inspection,
)


class InspectionConfidenceScoreTestMixin:
    @classmethod
    def setUpTestData(cls):
        SeedDemoDataCommand().handle()
        cls.device = Device.objects.get(identifier="demo-device-001")
        cls.inference_index = InferenceIndex.objects.get(name="leaf-demo-index")
        cls.now = timezone.now().replace(microsecond=0)

    def build_inspection(self, **overrides):
        data = {
            "device": self.device,
            "inference_index": self.inference_index,
            "organ_type": Inspection.OrganType.LEAF,
            "status": Inspection.Status.NEW,
            "processing_status": Inspection.ProcessingStatus.COMPLETED,
            "source_message_id": "confidence-test-message",
            "top1_label": "Healthy",
            "captured_at": self.now,
            "received_at": self.now,
            "processed_at": self.now + timedelta(minutes=1),
            "extra_metadata": {"source": "test"},
        }
        data.update(overrides)
        return Inspection(**data)

    def build_create_payload(self, confidence_score):
        return {
            "device": str(self.device.id),
            "inference_index": str(self.inference_index.id),
            "organ_type": Inspection.OrganType.LEAF,
            "status": Inspection.Status.NEW,
            "processing_status": Inspection.ProcessingStatus.COMPLETED,
            "source_message_id": "serializer-confidence-test",
            "top1_label": "Healthy",
            "confidence_score": confidence_score,
            "captured_at": self.now.isoformat(),
            "received_at": self.now.isoformat(),
            "processed_at": (self.now + timedelta(minutes=1)).isoformat(),
            "extra_metadata": {"source": "serializer-test"},
        }


class InspectionConfidenceScoreModelValidationTests(
    InspectionConfidenceScoreTestMixin, TestCase
):
    def test_model_full_clean_allows_null_and_in_range_values(self):
        valid_values = [None, 0, 0.5, 1]

        for value in valid_values:
            with self.subTest(confidence_score=value):
                inspection = self.build_inspection(confidence_score=value)
                inspection.full_clean()

    def test_model_full_clean_rejects_out_of_range_values(self):
        invalid_values = [-0.1, 1.1, 3, 50]

        for value in invalid_values:
            with self.subTest(confidence_score=value):
                inspection = self.build_inspection(confidence_score=value)
                with self.assertRaises(ValidationError) as exc_info:
                    inspection.full_clean()
                self.assertIn("confidence_score", exc_info.exception.message_dict)


class InspectionConfidenceScoreSerializerTests(
    InspectionConfidenceScoreTestMixin, TestCase
):
    def test_create_serializer_allows_null_and_in_range_values(self):
        valid_values = [None, 0, 0.5, 1]

        for value in valid_values:
            with self.subTest(confidence_score=value):
                serializer = InspectionCreateSerializer(
                    data=self.build_create_payload(value)
                )
                self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_create_serializer_rejects_out_of_range_values(self):
        invalid_values = [-0.1, 1.1, 3, 50]

        for value in invalid_values:
            with self.subTest(confidence_score=value):
                serializer = InspectionCreateSerializer(
                    data=self.build_create_payload(value)
                )
                self.assertFalse(serializer.is_valid())
                self.assertIn("confidence_score", serializer.errors)


class InspectionConfidenceScoreDatabaseConstraintTests(
    InspectionConfidenceScoreTestMixin, TestCase
):
    def test_database_constraint_allows_null_and_in_range_values(self):
        valid_values = [None, 0, 0.5, 1]

        for value in valid_values:
            with self.subTest(confidence_score=value):
                inspection = self.build_inspection(
                    source_message_id=f"db-valid-{value}",
                    confidence_score=value,
                )
                inspection.save(force_insert=True)

    def test_database_constraint_rejects_out_of_range_values(self):
        invalid_values = [-0.1, 1.1, 3, 50]

        for value in invalid_values:
            with self.subTest(confidence_score=value):
                inspection = self.build_inspection(
                    source_message_id=f"db-invalid-{value}",
                    confidence_score=value,
                )
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        inspection.save(force_insert=True)


class InspectionAdminConfidenceScoreTests(
    InspectionConfidenceScoreTestMixin, TestCase
):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        user_model = get_user_model()
        cls.admin_user = user_model.objects.get(username="admin")

    def build_admin_add_payload(self, confidence_score, source_message_id):
        return {
            "device": str(self.device.id),
            "inference_index": str(self.inference_index.id),
            "predicted_disease": "",
            "organ_type": Inspection.OrganType.LEAF,
            "status": Inspection.Status.NEW,
            "processing_status": Inspection.ProcessingStatus.COMPLETED,
            "source_message_id": source_message_id,
            "top1_label": "Healthy",
            "confidence_score": confidence_score,
            "captured_at_0": self.now.strftime("%Y-%m-%d"),
            "captured_at_1": self.now.strftime("%H:%M:%S"),
            "received_at_0": self.now.strftime("%Y-%m-%d"),
            "received_at_1": self.now.strftime("%H:%M:%S"),
            "processed_at_0": self.now.strftime("%Y-%m-%d"),
            "processed_at_1": self.now.strftime("%H:%M:%S"),
            "extra_metadata": '{"source": "admin-test"}',
            "matches-TOTAL_FORMS": "0",
            "matches-INITIAL_FORMS": "0",
            "matches-MIN_NUM_FORMS": "0",
            "matches-MAX_NUM_FORMS": "1000",
            "_save": "Save",
        }

    def test_admin_add_view_rejects_out_of_range_confidence_score(self):
        self.client.force_login(self.admin_user)

        response = self.client.post(
            reverse("admin:inspections_inspection_add"),
            data=self.build_admin_add_payload("50", "admin-invalid-confidence"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Ensure this value is less than or equal to 1.")
        self.assertFalse(
            Inspection.objects.filter(
                source_message_id="admin-invalid-confidence"
            ).exists()
        )

    def test_admin_add_view_renders_decimal_capable_confidence_widget(self):
        self.client.force_login(self.admin_user)

        response = self.client.get(reverse("admin:inspections_inspection_add"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="confidence_score"')
        self.assertContains(response, 'step="any"')
        self.assertContains(response, 'min="0"')
        self.assertContains(response, 'max="1"')

    def test_admin_add_view_accepts_decimal_confidence_score(self):
        self.client.force_login(self.admin_user)

        response = self.client.post(
            reverse("admin:inspections_inspection_add"),
            data=self.build_admin_add_payload("0.82", "admin-decimal-confidence"),
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        inspection = Inspection.objects.get(source_message_id="admin-decimal-confidence")
        self.assertEqual(inspection.confidence_score, 0.82)

    def test_admin_add_view_allows_blank_confidence_score(self):
        self.client.force_login(self.admin_user)

        response = self.client.post(
            reverse("admin:inspections_inspection_add"),
            data=self.build_admin_add_payload("", "admin-blank-confidence"),
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        inspection = Inspection.objects.get(source_message_id="admin-blank-confidence")
        self.assertIsNone(inspection.confidence_score)


class InspectionMapSignalsApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.user = user_model.objects.create_user(
            username="map-signals-user",
            password="map-signals-pass",
        )
        cls.now = timezone.now().replace(microsecond=0)
        cls.site = Site.objects.create(name="Map Site", location="North")
        cls.greenhouse = Greenhouse.objects.create(site=cls.site, name="Map GH")
        cls.zone = Zone.objects.create(greenhouse=cls.greenhouse, name="Map Zone")
        cls.line = Line.objects.create(zone=cls.zone, name="Map Line", code="map-line")
        cls.other_line = Line.objects.create(
            zone=cls.zone,
            name="Other Line",
            code="other-line",
        )
        cls.mapped_device = Device.objects.create(
            line=cls.line,
            name="Mapped Camera 1",
            identifier="mapped-camera-1",
            latitude=34.125,
            longitude=-6.831,
        )
        cls.mapped_device_two = Device.objects.create(
            line=cls.line,
            name="Mapped Camera 2",
            identifier="mapped-camera-2",
            latitude=34.135,
            longitude=-6.821,
        )
        cls.unmapped_device = Device.objects.create(
            line=cls.line,
            name="Unmapped Camera",
            identifier="unmapped-camera",
        )
        cls.other_line_device = Device.objects.create(
            line=cls.other_line,
            name="Other Line Camera",
            identifier="other-line-camera",
            latitude=34.225,
            longitude=-6.731,
        )
        cls.model_version = ModelVersion.objects.create(
            name="Map Signal Model",
            version="v1",
        )
        cls.leaf_index = InferenceIndex.objects.create(
            model_version=cls.model_version,
            name="map-leaf-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )
        cls.fruit_index = InferenceIndex.objects.create(
            model_version=cls.model_version,
            name="map-fruit-index",
            organ_type=InferenceIndex.OrganType.FRUIT,
        )
        cls.early_blight = cls._create_disease("Early Blight", "leaf", "early_blight", "leaf-early-blight")
        cls.late_blight = cls._create_disease("Late Blight", "leaf", "late_blight", "leaf-late-blight")
        cls.fruit_late_blight = cls._create_disease(
            "Late Blight",
            "fruit",
            "late_blight",
            "fruit-late-blight",
        )
        cls.healthy = cls._create_disease("Healthy", "leaf", "healthy", "leaf-healthy")
        cls.fruit_healthy = cls._create_disease("Healthy", "fruit", "healthy", "fruit-healthy")
        cls.leaf_curl = cls._create_disease("Leaf Curl", "leaf", "leaf_curl", "leaf-leaf-curl")
        cls.blossom_end_rot = cls._create_disease(
            "Blossom End Rot",
            "fruit",
            "blossom_end_rot",
            "fruit-blossom-end-rot",
        )
        cls._create_profile(
            cls.early_blight,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.FUNGAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.SPLASH,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=4,
            risk_level=DiseaseMapProfile.RiskLevel.HIGH,
            map_label="Early blight risk",
        )
        cls._create_profile(
            cls.late_blight,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.OOMYCETE,
            transmission_mode=DiseaseMapProfile.TransmissionMode.AIRBORNE,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=8,
            risk_level=DiseaseMapProfile.RiskLevel.CRITICAL,
            map_label="Late blight high-risk zone",
        )
        cls._create_profile(
            cls.fruit_late_blight,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.OOMYCETE,
            transmission_mode=DiseaseMapProfile.TransmissionMode.AIRBORNE,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=8,
            risk_level=DiseaseMapProfile.RiskLevel.CRITICAL,
            map_label="Late blight high-risk zone",
        )
        cls._create_profile(cls.healthy)
        cls._create_profile(cls.fruit_healthy)
        cls._create_profile(
            cls.leaf_curl,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.VIRAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.VECTOR_WHITEFLY,
            zone_type=DiseaseMapProfile.ZoneType.VECTOR_RISK_ZONE,
            spread_radius_m=5,
            risk_level=DiseaseMapProfile.RiskLevel.HIGH,
            map_label="Whitefly vector risk",
        )
        cls._create_profile(
            cls.blossom_end_rot,
            is_infectious=False,
            spread_category=DiseaseMapProfile.SpreadCategory.PHYSIOLOGICAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.NUTRIENT_WATER_IMBALANCE,
            zone_type=DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
            spread_radius_m=2,
            risk_level=DiseaseMapProfile.RiskLevel.MEDIUM,
            map_label="Calcium/water stress risk",
        )

        cls.early_signal = cls._create_inspection(
            device=cls.mapped_device,
            disease=cls.early_blight,
            label="Early Blight",
            confidence_score=0.76,
            captured_offset=timedelta(hours=2),
        )
        cls.early_signal_same_line = cls._create_inspection(
            device=cls.mapped_device_two,
            disease=cls.early_blight,
            label="Early Blight",
            confidence_score=0.91,
            captured_offset=timedelta(hours=1),
            source_message_id="early-same-line",
        )
        cls.unmapped_late_signal = cls._create_inspection(
            device=cls.unmapped_device,
            disease=cls.late_blight,
            label="Late Blight",
            confidence_score=0.92,
            captured_offset=timedelta(hours=3),
            source_message_id="unmapped-late",
        )
        cls.other_line_late_signal = cls._create_inspection(
            device=cls.other_line_device,
            disease=cls.late_blight,
            label="Early Blight",
            confidence_score=0.88,
            captured_offset=timedelta(hours=4),
            source_message_id="corrected-late",
        )
        cls.healthy_signal = cls._create_inspection(
            device=cls.mapped_device,
            disease=cls.healthy,
            label="Healthy",
            confidence_score=0.99,
            captured_offset=timedelta(hours=5),
            source_message_id="healthy",
        )
        cls.no_zone_signal = cls._create_inspection(
            device=cls.mapped_device,
            disease=cls.blossom_end_rot,
            label="Blossom End Rot",
            confidence_score=0.9,
            captured_offset=timedelta(hours=6),
            source_message_id="blossom-end-rot",
            organ_type=Inspection.OrganType.FRUIT,
        )

    @classmethod
    def _create_disease(cls, name, organ_type, ai_label, slug):
        disease, _ = Disease.objects.update_or_create(
            organ_type=organ_type,
            ai_label=ai_label,
            defaults={
                "name": name,
                "slug": slug,
            },
        )
        return disease

    @classmethod
    def _create_profile(cls, disease, **overrides):
        defaults = {
            "is_infectious": False,
            "spread_category": DiseaseMapProfile.SpreadCategory.NONE,
            "transmission_mode": DiseaseMapProfile.TransmissionMode.NONE,
            "zone_type": DiseaseMapProfile.ZoneType.NONE,
            "spread_radius_m": 0,
            "risk_level": DiseaseMapProfile.RiskLevel.LOW,
            "map_label": disease.name,
            "short_map_description": "Test map profile.",
            "is_active": True,
        }
        defaults.update(overrides)
        profile, _ = DiseaseMapProfile.objects.update_or_create(
            disease=disease,
            defaults=defaults,
        )
        return profile

    @classmethod
    def _create_inspection(
        cls,
        *,
        device,
        disease,
        label,
        confidence_score,
        captured_offset,
        source_message_id=None,
        organ_type=Inspection.OrganType.LEAF,
    ):
        captured_at = cls.now - captured_offset
        inference_index = cls.leaf_index if organ_type == Inspection.OrganType.LEAF else cls.fruit_index

        return Inspection.objects.create(
            device=device,
            inference_index=inference_index,
            predicted_disease=disease,
            organ_type=organ_type,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id=source_message_id or f"{slugify(label)}-{confidence_score}",
            top1_label=label,
            confidence_score=confidence_score,
            captured_at=captured_at,
            received_at=captured_at,
            processed_at=captured_at + timedelta(minutes=1),
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_map_signals_excludes_healthy_and_counts_unmapped_signals(self):
        response = self.client.get(reverse("inspection-map-signals"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        disease_keys = {signal["disease_key"] for signal in response.data["signals"]}

        self.assertNotIn("healthy", disease_keys)
        self.assertEqual(response.data["summary"]["total_signals"], 5)
        self.assertEqual(response.data["summary"]["mapped_signals"], 4)
        self.assertEqual(response.data["summary"]["unmapped_signals"], 1)

    def test_map_signals_response_contains_compatible_sections(self):
        response = self.client.get(reverse("inspection-map-signals"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("available_diseases", response.data["filters"])
        self.assertIn("signals", response.data)
        self.assertIn("infection_zones", response.data)
        self.assertIn("summary", response.data)
        self.assertTrue(response.data["signals"])

        signal = response.data["signals"][0]
        for field_name in (
            "organ_type",
            "ai_label",
            "zone_type",
            "is_infectious",
            "spread_category",
            "transmission_mode",
            "spread_radius_m",
            "risk_level",
            "map_color",
            "map_label",
            "short_map_description",
            "profile_missing",
            "profile_inactive",
            "zone_policy",
            "spread_type",
        ):
            self.assertIn(field_name, signal)

    def test_disease_filter_limits_signals_and_zones(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(self.early_blight.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 2)
        self.assertEqual({signal["disease_key"] for signal in response.data["signals"]}, {"early_blight"})
        self.assertEqual(len(response.data["infection_zones"]), 1)
        self.assertEqual(response.data["infection_zones"][0]["signal_count"], 2)

    def test_disease_name_filter_accepts_profile_key(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease_name": "late_blight"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 2)
        self.assertEqual({signal["disease_key"] for signal in response.data["signals"]}, {"late_blight"})

    def test_severity_filter_uses_notification_threshold(self):
        response = self.client.get(reverse("inspection-map-signals"), {"severity": "high"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["signals"])
        self.assertTrue(all(signal["severity"] == "high" for signal in response.data["signals"]))
        self.assertNotIn(str(self.early_signal.id), {signal["inspection_id"] for signal in response.data["signals"]})

    def test_min_confidence_filter_limits_signals(self):
        response = self.client.get(reverse("inspection-map-signals"), {"min_confidence": "0.9"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["signals"])
        self.assertTrue(all(signal["confidence"] >= 0.9 for signal in response.data["signals"]))

    def test_physiological_disease_creates_agronomic_risk_zone_not_infection_zone(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(self.blossom_end_rot.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["disease_key"], "blossom_end_rot")
        self.assertFalse(response.data["signals"][0]["is_infectious"])
        self.assertEqual(
            response.data["signals"][0]["zone_type"],
            DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
        )
        self.assertEqual(len(response.data["infection_zones"]), 1)
        self.assertEqual(
            response.data["infection_zones"][0]["zone_type"],
            DiseaseMapProfile.ZoneType.AGRONOMIC_RISK_ZONE,
        )
        self.assertNotEqual(
            response.data["infection_zones"][0]["zone_type"],
            DiseaseMapProfile.ZoneType.INFECTION_ZONE,
        )

    def test_infection_zone_generation_uses_disease_profile_and_centroid(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(self.early_blight.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        zone = response.data["infection_zones"][0]

        self.assertTrue(zone["id"].startswith("zone-"))
        self.assertEqual(zone["disease_key"], "early_blight")
        self.assertEqual(zone["zone_policy"], DiseaseMapProfile.ZoneType.INFECTION_ZONE)
        self.assertEqual(zone["zone_type"], DiseaseMapProfile.ZoneType.INFECTION_ZONE)
        self.assertEqual(zone["spread_radius_m"], 4)
        self.assertEqual(zone["severity"], "high")
        self.assertEqual(zone["center"]["latitude"], 34.13)
        self.assertEqual(zone["center"]["longitude"], -6.826)
        self.assertEqual(zone["radius_meters"], 4)

    def test_vector_disease_creates_vector_risk_zone(self):
        self._create_inspection(
            device=self.mapped_device,
            disease=self.leaf_curl,
            label="Leaf Curl",
            confidence_score=0.93,
            captured_offset=timedelta(minutes=30),
            source_message_id="leaf-curl-vector-zone",
        )

        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(self.leaf_curl.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        zone = response.data["infection_zones"][0]
        self.assertEqual(zone["disease_key"], "leaf_curl")
        self.assertEqual(zone["zone_type"], DiseaseMapProfile.ZoneType.VECTOR_RISK_ZONE)
        self.assertEqual(zone["transmission_mode"], DiseaseMapProfile.TransmissionMode.VECTOR_WHITEFLY)
        self.assertEqual(zone["radius_meters"], 5)

    def test_healthy_fruit_and_leaf_create_no_signal_or_zone(self):
        self._create_inspection(
            device=self.mapped_device_two,
            disease=self.fruit_healthy,
            label="Healthy",
            confidence_score=0.97,
            captured_offset=timedelta(minutes=45),
            source_message_id="fruit-healthy-map-signal",
            organ_type=Inspection.OrganType.FRUIT,
        )

        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease_name": "healthy"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 0)
        self.assertEqual(response.data["signals"], [])
        self.assertEqual(response.data["infection_zones"], [])

    def test_missing_map_profile_does_not_crash_and_creates_no_zone(self):
        profileless_disease = self._create_disease(
            "Profileless Disease",
            "leaf",
            "profileless_disease",
            "leaf-profileless-disease",
        )
        self._create_inspection(
            device=self.mapped_device,
            disease=profileless_disease,
            label="Profileless Disease",
            confidence_score=0.87,
            captured_offset=timedelta(minutes=20),
            source_message_id="profileless-map-signal",
        )

        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(profileless_disease.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["profile_missing"], True)
        self.assertEqual(response.data["signals"][0]["zone_type"], DiseaseMapProfile.ZoneType.NONE)
        self.assertEqual(response.data["infection_zones"], [])

    def test_inactive_map_profile_creates_signal_but_no_zone(self):
        inactive_disease = self._create_disease(
            "Inactive Profile Disease",
            "leaf",
            "inactive_profile_disease",
            "leaf-inactive-profile-disease",
        )
        self._create_profile(
            inactive_disease,
            is_infectious=True,
            spread_category=DiseaseMapProfile.SpreadCategory.FUNGAL,
            transmission_mode=DiseaseMapProfile.TransmissionMode.SPLASH,
            zone_type=DiseaseMapProfile.ZoneType.INFECTION_ZONE,
            spread_radius_m=9,
            risk_level=DiseaseMapProfile.RiskLevel.HIGH,
            is_active=False,
        )
        self._create_inspection(
            device=self.mapped_device,
            disease=inactive_disease,
            label="Inactive Profile Disease",
            confidence_score=0.9,
            captured_offset=timedelta(minutes=10),
            source_message_id="inactive-profile-map-signal",
        )

        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(inactive_disease.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["profile_inactive"], True)
        self.assertEqual(response.data["signals"][0]["spread_radius_m"], 9)
        self.assertEqual(response.data["infection_zones"], [])

    def test_late_blight_fruit_and_leaf_use_organ_specific_disease_records(self):
        fruit_signal = self._create_inspection(
            device=self.mapped_device,
            disease=self.fruit_late_blight,
            label="Late Blight",
            confidence_score=0.94,
            captured_offset=timedelta(minutes=15),
            source_message_id="fruit-late-blight-map-signal",
            organ_type=Inspection.OrganType.FRUIT,
        )

        combined_response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease_name": "late_blight"},
        )
        fruit_response = self.client.get(
            reverse("inspection-map-signals"),
            {
                "disease_name": "late_blight",
                "organ_type": Inspection.OrganType.FRUIT,
            },
        )

        self.assertEqual(combined_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {signal["organ_type"] for signal in combined_response.data["signals"]},
            {Inspection.OrganType.FRUIT, Inspection.OrganType.LEAF},
        )
        self.assertEqual(fruit_response.status_code, status.HTTP_200_OK)
        self.assertEqual(fruit_response.data["summary"]["total_signals"], 1)
        self.assertEqual(fruit_response.data["signals"][0]["inspection_id"], str(fruit_signal.id))
        self.assertEqual(fruit_response.data["signals"][0]["disease_id"], str(self.fruit_late_blight.id))
        self.assertEqual(fruit_response.data["infection_zones"][0]["risk_level"], DiseaseMapProfile.RiskLevel.CRITICAL)

    def test_hierarchy_filter_limits_signals_by_line(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"line": str(self.other_line.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["line_id"], str(self.other_line.id))

    def test_status_filter_limits_signals(self):
        self.early_signal.status = Inspection.Status.REVIEWED
        self.early_signal.save(update_fields=["status"])

        response = self.client.get(
            reverse("inspection-map-signals"),
            {"status": Inspection.Status.REVIEWED},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["inspection_id"], str(self.early_signal.id))

    def test_processing_status_filter_preserves_completed_only_archive_behavior(self):
        failed_signal = self._create_inspection(
            device=self.mapped_device,
            disease=self.early_blight,
            label="Early Blight",
            confidence_score=0.83,
            captured_offset=timedelta(minutes=12),
            source_message_id="failed-processing-map-signal",
        )
        failed_signal.processing_status = Inspection.ProcessingStatus.FAILED
        failed_signal.save(update_fields=["processing_status"])

        completed_response = self.client.get(
            reverse("inspection-map-signals"),
            {"processing_status": Inspection.ProcessingStatus.COMPLETED},
        )
        failed_response = self.client.get(
            reverse("inspection-map-signals"),
            {"processing_status": Inspection.ProcessingStatus.FAILED},
        )

        self.assertEqual(completed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(failed_response.status_code, status.HTTP_200_OK)
        self.assertTrue(completed_response.data["summary"]["total_signals"] > 0)
        self.assertEqual(failed_response.data["summary"]["total_signals"], 0)
        self.assertEqual(failed_response.data["signals"], [])

    def test_review_corrected_predicted_disease_is_respected_over_top1_label(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"device": str(self.other_line_device.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        signal = response.data["signals"][0]

        self.assertEqual(signal["disease_key"], "late_blight")
        self.assertEqual(signal["disease_name"], "Late Blight")
        self.assertEqual(signal["label"], "Late Blight")

    def test_latest_per_device_returns_only_the_most_recent_signal_for_each_device(self):
        newest_signal = self._create_inspection(
            device=self.mapped_device,
            disease=self.late_blight,
            label="Late Blight",
            confidence_score=0.95,
            captured_offset=timedelta(minutes=30),
            source_message_id="mapped-device-newest-late-blight",
        )

        default_response = self.client.get(reverse("inspection-map-signals"))
        latest_per_device_response = self.client.get(
            reverse("inspection-map-signals"),
            {"latest_per_device": "true"},
        )

        self.assertEqual(default_response.status_code, status.HTTP_200_OK)
        self.assertEqual(latest_per_device_response.status_code, status.HTTP_200_OK)
        self.assertEqual(default_response.data["summary"]["total_signals"], 6)
        self.assertEqual(latest_per_device_response.data["summary"]["total_signals"], 4)
        self.assertEqual(latest_per_device_response.data["summary"]["mapped_signals"], 3)
        self.assertEqual(latest_per_device_response.data["summary"]["unmapped_signals"], 1)

        latest_signals = latest_per_device_response.data["signals"]
        mapped_device_signals = [
            signal for signal in latest_signals
            if signal["device_id"] == str(self.mapped_device.id)
        ]
        self.assertEqual(len(mapped_device_signals), 1)
        self.assertEqual(mapped_device_signals[0]["inspection_id"], str(newest_signal.id))
        self.assertEqual(mapped_device_signals[0]["disease_key"], "late_blight")

        latest_zone_keys = {
            (zone["line_name"], zone["disease_key"])
            for zone in latest_per_device_response.data["infection_zones"]
        }
        self.assertIn((self.line.name, "late_blight"), latest_zone_keys)

    def test_latest_per_device_rejects_invalid_boolean_value(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"latest_per_device": "sometimes"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("latest_per_device", response.data)


class InspectionDiseaseResolutionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.now = timezone.now().replace(microsecond=0)
        cls.site = Site.objects.create(name="Resolution Site", location="North")
        cls.greenhouse = Greenhouse.objects.create(site=cls.site, name="Resolution GH")
        cls.zone = Zone.objects.create(greenhouse=cls.greenhouse, name="Resolution Zone")
        cls.line = Line.objects.create(zone=cls.zone, name="Resolution Line", code="resolution-line")
        cls.device = Device.objects.create(
            line=cls.line,
            name="Resolution Camera",
            identifier="resolution-camera",
        )
        cls.model_version = ModelVersion.objects.create(name="Resolution Model", version="v1")
        cls.fruit_index = InferenceIndex.objects.create(
            model_version=cls.model_version,
            name="resolution-fruit-index",
            organ_type=InferenceIndex.OrganType.FRUIT,
        )
        cls.leaf_index = InferenceIndex.objects.create(
            model_version=cls.model_version,
            name="resolution-leaf-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )
        cls.fruit_late_blight = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="late_blight",
        )
        cls.leaf_late_blight = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="late_blight",
        )
        cls.fruit_healthy = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="healthy",
        )
        cls.leaf_healthy = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="healthy",
        )
        cls.leaf_curl = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="leaf_curl",
        )

    def _create_inspection_from_label(self, *, organ_type, top1_label, inference_index):
        return create_inspection_with_matches(
            inspection_data={
                "device": self.device,
                "inference_index": inference_index,
                "organ_type": organ_type,
                "status": Inspection.Status.NEW,
                "processing_status": Inspection.ProcessingStatus.COMPLETED,
                "source_message_id": f"resolution-{organ_type}-{top1_label}",
                "top1_label": top1_label,
                "confidence_score": 0.91,
                "captured_at": self.now,
                "received_at": self.now,
                "processed_at": self.now + timedelta(minutes=1),
                "extra_metadata": {"source": "resolution-test"},
            },
            matches_data=[
                {
                    "rank_order": 1,
                    "matched_label": top1_label,
                    "similarity_score": 0.91,
                    "metadata_json": {},
                }
            ],
        )

    def test_late_blight_top1_label_resolves_by_organ_type(self):
        fruit_inspection = self._create_inspection_from_label(
            organ_type=Inspection.OrganType.FRUIT,
            top1_label="late_blight",
            inference_index=self.fruit_index,
        )
        leaf_inspection = self._create_inspection_from_label(
            organ_type=Inspection.OrganType.LEAF,
            top1_label="Late Blight",
            inference_index=self.leaf_index,
        )

        self.assertEqual(fruit_inspection.predicted_disease, self.fruit_late_blight)
        self.assertEqual(leaf_inspection.predicted_disease, self.leaf_late_blight)
        self.assertEqual(fruit_inspection.matches.get(rank_order=1).disease, self.fruit_late_blight)
        self.assertEqual(leaf_inspection.matches.get(rank_order=1).disease, self.leaf_late_blight)

    def test_healthy_top1_label_resolves_by_organ_type(self):
        fruit_inspection = self._create_inspection_from_label(
            organ_type=Inspection.OrganType.FRUIT,
            top1_label="healthy",
            inference_index=self.fruit_index,
        )
        leaf_inspection = self._create_inspection_from_label(
            organ_type=Inspection.OrganType.LEAF,
            top1_label="Healthy",
            inference_index=self.leaf_index,
        )

        self.assertEqual(fruit_inspection.predicted_disease, self.fruit_healthy)
        self.assertEqual(leaf_inspection.predicted_disease, self.leaf_healthy)

    def test_explicit_predicted_disease_id_behavior_is_preserved(self):
        inspection = create_inspection_with_matches(
            inspection_data={
                "device": self.device,
                "inference_index": self.leaf_index,
                "predicted_disease": self.leaf_curl,
                "organ_type": Inspection.OrganType.LEAF,
                "status": Inspection.Status.NEW,
                "processing_status": Inspection.ProcessingStatus.COMPLETED,
                "source_message_id": "explicit-disease-resolution",
                "top1_label": "late_blight",
                "confidence_score": 0.88,
                "captured_at": self.now,
                "received_at": self.now,
                "processed_at": self.now + timedelta(minutes=1),
                "extra_metadata": {"source": "explicit-test"},
            },
            matches_data=[],
        )

        self.assertEqual(inspection.predicted_disease, self.leaf_curl)


class InspectionDashboardRefreshTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        SeedDemoDataCommand().handle()
        cls.device = Device.objects.get(identifier="demo-device-001")
        cls.inference_index = InferenceIndex.objects.get(name="leaf-demo-index")
        cls.healthy_disease = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="healthy",
        )
        cls.now = timezone.now().replace(microsecond=0)

    def test_create_inspection_with_matches_emits_dashboard_refresh_for_new_inspection(self):
        with patch("apps.inspections.services.schedule_dashboard_refresh_event") as refresh_mock:
            inspection = create_inspection_with_matches(
                inspection_data={
                    "device": self.device,
                    "inference_index": self.inference_index,
                    "predicted_disease": self.healthy_disease,
                    "organ_type": Inspection.OrganType.LEAF,
                    "status": Inspection.Status.NEW,
                    "processing_status": Inspection.ProcessingStatus.COMPLETED,
                    "source_message_id": "dashboard-refresh-inspection-create",
                    "top1_label": self.healthy_disease.name,
                    "confidence_score": 0.91,
                    "captured_at": self.now,
                    "received_at": self.now,
                    "processed_at": self.now + timedelta(minutes=1),
                    "extra_metadata": {"source": "dashboard-refresh-test"},
                },
                matches_data=[],
            )

        self.assertIsNotNone(inspection.id)
        refresh_mock.assert_called_once_with("inspection.created")

    def test_duplicate_ai_ingestion_replay_does_not_emit_dashboard_refresh(self):
        inspection = Inspection.objects.create(
            device=self.device,
            inference_index=self.inference_index,
            predicted_disease=self.healthy_disease,
            organ_type=Inspection.OrganType.LEAF,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id="dashboard-refresh-duplicate",
            top1_label=self.healthy_disease.name,
            confidence_score=0.88,
            captured_at=self.now,
            received_at=self.now,
            processed_at=self.now + timedelta(minutes=1),
            extra_metadata={"source": "existing-inspection"},
        )

        ai_result_data = {
            "schema_version": "ai-worker-result.v1",
            "message_type": "inspection_result",
            "source_message_id": inspection.source_message_id,
            "device_identifier": self.device.identifier,
            "organ_type": Inspection.OrganType.LEAF,
            "captured_at": self.now,
            "received_at": self.now,
            "processed_at": self.now + timedelta(minutes=1),
            "feature_model": "TestModel",
            "feature_dim": 1280,
            "l2_normalized": True,
            "matches": [],
            "extra_metadata": {},
        }

        with patch("apps.inspections.services.schedule_dashboard_refresh_event") as refresh_mock:
            outcome = ingest_ai_result_payload(ai_result_data=ai_result_data)

        self.assertFalse(outcome.created)
        self.assertTrue(outcome.duplicate)
        refresh_mock.assert_not_called()


class EvidenceImageRequestServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        SeedDemoDataCommand().handle()
        cls.device = Device.objects.get(identifier="demo-device-001")
        cls.leaf_index = InferenceIndex.objects.get(name="leaf-demo-index")
        cls.fruit_index = InferenceIndex.objects.get(name="fruit-demo-index")
        cls.leaf_healthy = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="healthy",
        )
        cls.fruit_late_blight = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="late_blight",
        )
        cls.now = timezone.now().replace(microsecond=0)

    def _create_inspection(
        self,
        *,
        source_message_id,
        disease,
        inference_index,
        organ_type,
        top1_label,
        requires_review=False,
        worker_extra_metadata=None,
    ):
        return Inspection.objects.create(
            device=self.device,
            inference_index=inference_index,
            predicted_disease=disease,
            organ_type=organ_type,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id=source_message_id,
            top1_label=top1_label,
            confidence_score=0.91,
            captured_at=self.now,
            received_at=self.now,
            processed_at=self.now + timedelta(minutes=1),
            extra_metadata={
                "ai_result": {
                    "requires_review": requires_review,
                },
                "worker_extra_metadata": worker_extra_metadata or {},
            },
        )

    def test_disease_positive_inspection_creates_pending_evidence_request(self):
        inspection = self._create_inspection(
            source_message_id="evidence-request-disease-positive",
            disease=self.fruit_late_blight,
            inference_index=self.fruit_index,
            organ_type=Inspection.OrganType.FRUIT,
            top1_label="late_blight",
            worker_extra_metadata={"image_id": "fruit-image-001"},
        )

        first_outcome = maybe_create_evidence_image_request_for_inspection(inspection)
        second_outcome = maybe_create_evidence_image_request_for_inspection(inspection)

        self.assertTrue(first_outcome.created)
        self.assertFalse(second_outcome.created)
        self.assertEqual(
            EvidenceImageRequest.objects.filter(inspection=inspection).count(),
            1,
        )

        evidence_request = EvidenceImageRequest.objects.get(inspection=inspection)
        self.assertEqual(
            evidence_request.reason,
            EvidenceImageRequest.Reason.DISEASE_ALERT,
        )
        self.assertEqual(evidence_request.status, EvidenceImageRequest.Status.PENDING)
        self.assertEqual(evidence_request.device, self.device)
        self.assertEqual(evidence_request.source_message_id, inspection.source_message_id)
        self.assertEqual(evidence_request.image_id, "fruit-image-001")
        self.assertEqual(evidence_request.local_image_ref, "")

    def test_requires_review_inspection_creates_pending_review_required_request(self):
        inspection = self._create_inspection(
            source_message_id="evidence-request-review-required",
            disease=self.leaf_healthy,
            inference_index=self.leaf_index,
            organ_type=Inspection.OrganType.LEAF,
            top1_label="healthy",
            requires_review=True,
            worker_extra_metadata={
                "image_id": "leaf-image-001",
                "capture_artifact": {
                    "local_image_ref": "cap-leaf-001",
                },
            },
        )

        outcome = maybe_create_evidence_image_request_for_inspection(inspection)

        self.assertTrue(outcome.created)
        evidence_request = EvidenceImageRequest.objects.get(inspection=inspection)
        self.assertEqual(
            evidence_request.reason,
            EvidenceImageRequest.Reason.REVIEW_REQUIRED,
        )
        self.assertEqual(evidence_request.local_image_ref, "cap-leaf-001")
        self.assertEqual(evidence_request.image_id, "leaf-image-001")

    def test_healthy_inspection_without_review_does_not_create_request(self):
        inspection = self._create_inspection(
            source_message_id="evidence-request-healthy-no-review",
            disease=self.leaf_healthy,
            inference_index=self.leaf_index,
            organ_type=Inspection.OrganType.LEAF,
            top1_label="healthy",
            requires_review=False,
        )

        outcome = maybe_create_evidence_image_request_for_inspection(inspection)

        self.assertFalse(outcome.created)
        self.assertIsNone(outcome.evidence_request)
        self.assertFalse(
            EvidenceImageRequest.objects.filter(inspection=inspection).exists()
        )

    def test_review_required_has_priority_over_disease_alert(self):
        inspection = self._create_inspection(
            source_message_id="evidence-request-priority-review",
            disease=self.fruit_late_blight,
            inference_index=self.fruit_index,
            organ_type=Inspection.OrganType.FRUIT,
            top1_label="late_blight",
            requires_review=True,
        )

        maybe_create_evidence_image_request_for_inspection(inspection)

        evidence_request = EvidenceImageRequest.objects.get(inspection=inspection)
        self.assertEqual(
            evidence_request.reason,
            EvidenceImageRequest.Reason.REVIEW_REQUIRED,
        )


@override_settings(
    EVIDENCE_IMAGE_UPLOAD_TOKEN="phase9-evidence-upload-token",
    MEDIA_URL="/media/",
)
class EvidenceImageUploadApiTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._temp_media_dir = tempfile.TemporaryDirectory()
        cls._media_override = override_settings(MEDIA_ROOT=cls._temp_media_dir.name)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        cls._temp_media_dir.cleanup()
        super().tearDownClass()

    @classmethod
    def setUpTestData(cls):
        SeedDemoDataCommand().handle()
        cls.user = get_user_model().objects.get(username="admin")
        cls.device = Device.objects.get(identifier="demo-device-001")
        cls.leaf_index = InferenceIndex.objects.get(name="leaf-demo-index")
        cls.leaf_healthy = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="healthy",
        )
        cls.now = timezone.now().replace(microsecond=0)
        cls.url = reverse("inspection-evidence-image-upload")

    def setUp(self):
        self._sequence = 0

    def _next_source_message_id(self):
        self._sequence += 1
        return f"evidence-upload-source-{self._sequence}"

    def _create_pending_request(self, *, source_message_id=None):
        source_message_id = source_message_id or self._next_source_message_id()
        inspection = Inspection.objects.create(
            device=self.device,
            inference_index=self.leaf_index,
            predicted_disease=self.leaf_healthy,
            organ_type=Inspection.OrganType.LEAF,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id=source_message_id,
            top1_label="healthy",
            confidence_score=0.85,
            captured_at=self.now,
            received_at=self.now,
            processed_at=self.now + timedelta(minutes=1),
            extra_metadata={"ai_result": {"requires_review": True}},
        )
        evidence_request = EvidenceImageRequest.objects.create(
            inspection=inspection,
            device=self.device,
            source_message_id=source_message_id,
            image_id=f"{source_message_id}-image",
            local_image_ref=f"{source_message_id}-ref",
            reason=EvidenceImageRequest.Reason.REVIEW_REQUIRED,
            status=EvidenceImageRequest.Status.PENDING,
            request_payload={"source_message_id": source_message_id},
        )
        return inspection, evidence_request

    def _make_upload_file(self, *, name="evidence.jpg", content=b"fake-image-bytes"):
        return SimpleUploadedFile(name, content, content_type="image/jpeg")

    def _checksum_for(self, content):
        return hashlib.sha256(content).hexdigest()

    def _post_upload(self, data, *, token="phase9-evidence-upload-token"):
        headers = {}
        if token is not None:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return self.client.post(
            self.url,
            data=data,
            format="multipart",
            **headers,
        )

    def test_missing_token_is_rejected(self):
        _, evidence_request = self._create_pending_request()

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
                "image": self._make_upload_file(),
            },
            token=None,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_wrong_token_is_rejected(self):
        _, evidence_request = self._create_pending_request()

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
                "image": self._make_upload_file(),
            },
            token="wrong-token",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_request_id_is_rejected(self):
        response = self._post_upload(
            {
                "request_id": "f6c2c90f-a430-4f92-b9f9-0ef0321b75d0",
                "source_message_id": "missing-request-source",
                "device_identifier": self.device.identifier,
                "image": self._make_upload_file(),
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("request_id", response.data)

    def test_source_message_id_mismatch_is_rejected(self):
        _, evidence_request = self._create_pending_request()

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": "different-source-message-id",
                "device_identifier": self.device.identifier,
                "image": self._make_upload_file(),
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("source_message_id", response.data)

    def test_device_identifier_mismatch_is_rejected(self):
        _, evidence_request = self._create_pending_request()

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": "other-device-001",
                "image": self._make_upload_file(),
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("device_identifier", response.data)

    def test_missing_file_is_rejected(self):
        _, evidence_request = self._create_pending_request()

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

    def test_checksum_mismatch_is_rejected(self):
        _, evidence_request = self._create_pending_request()
        file_content = b"phase9-evidence-image"

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
                "image_sha256": "0" * 64,
                "image": self._make_upload_file(content=file_content),
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image_sha256", response.data)

    def test_valid_upload_creates_evidence_image_and_marks_request_uploaded(self):
        inspection, evidence_request = self._create_pending_request()
        file_content = b"phase9-valid-evidence-image"
        checksum = self._checksum_for(file_content)

        response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
                "image_sha256": checksum,
                "image": self._make_upload_file(content=file_content),
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data,
            {
                "uploaded": True,
                "duplicate": False,
                "inspection_id": str(inspection.id),
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "evidence_image_id": response.data["evidence_image_id"],
            },
        )

        evidence_request.refresh_from_db()
        evidence_image = InspectionEvidenceImage.objects.get(request=evidence_request)
        self.assertEqual(evidence_request.status, EvidenceImageRequest.Status.UPLOADED)
        self.assertIsNotNone(evidence_request.uploaded_at)
        self.assertEqual(evidence_request.response_metadata["image_sha256"], checksum)
        self.assertEqual(evidence_image.inspection, inspection)
        self.assertEqual(evidence_image.device, self.device)
        self.assertEqual(evidence_image.source_message_id, evidence_request.source_message_id)
        self.assertEqual(evidence_image.image_sha256, checksum)
        self.assertEqual(evidence_image.original_filename, "evidence.jpg")
        self.assertEqual(evidence_image.mime_type, "image/jpeg")
        self.assertEqual(evidence_image.size_bytes, len(file_content))

    def test_repeated_upload_returns_idempotent_success_without_duplicate_image(self):
        _, evidence_request = self._create_pending_request()
        file_content = b"phase9-duplicate-evidence-image"
        checksum = self._checksum_for(file_content)

        first_response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
                "image_sha256": checksum,
                "image": self._make_upload_file(content=file_content),
            }
        )
        second_response = self._post_upload(
            {
                "request_id": str(evidence_request.id),
                "source_message_id": evidence_request.source_message_id,
                "device_identifier": self.device.identifier,
                "image_sha256": checksum,
                "image": self._make_upload_file(content=file_content),
            }
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertTrue(second_response.data["uploaded"])
        self.assertTrue(second_response.data["duplicate"])
        self.assertEqual(
            InspectionEvidenceImage.objects.filter(request=evidence_request).count(),
            1,
        )

    def test_inspection_detail_includes_pending_evidence_summary(self):
        inspection, _ = self._create_pending_request(source_message_id="inspection-detail-pending")
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("inspection-detail", args=[inspection.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["evidence_request_status"], EvidenceImageRequest.Status.PENDING)
        self.assertEqual(response.data["evidence_request_reason"], EvidenceImageRequest.Reason.REVIEW_REQUIRED)
        self.assertIsNone(response.data["evidence_image_status"])
        self.assertIsNone(response.data["evidence_image_url"])

    def test_inspection_detail_includes_uploaded_evidence_summary(self):
        inspection, evidence_request = self._create_pending_request(source_message_id="inspection-detail-uploaded")
        InspectionEvidenceImage.objects.create(
            inspection=inspection,
            request=evidence_request,
            device=self.device,
            source_message_id=inspection.source_message_id,
            image=self._make_upload_file(name="uploaded.jpg", content=b"uploaded-evidence"),
            original_filename="uploaded.jpg",
            mime_type="image/jpeg",
            size_bytes=len(b"uploaded-evidence"),
            image_sha256=self._checksum_for(b"uploaded-evidence"),
            uploaded_at=self.now + timedelta(minutes=2),
            metadata={},
        )
        evidence_request.status = EvidenceImageRequest.Status.UPLOADED
        evidence_request.uploaded_at = self.now + timedelta(minutes=2)
        evidence_request.save(update_fields=["status", "uploaded_at"])
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("inspection-detail", args=[inspection.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["evidence_request_status"], EvidenceImageRequest.Status.UPLOADED)
        self.assertEqual(response.data["evidence_image_status"], EvidenceImageRequest.Status.UPLOADED)
        self.assertTrue(response.data["evidence_image_url"].endswith("/uploaded.jpg"))

