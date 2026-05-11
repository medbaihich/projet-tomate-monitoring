from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Disease
from apps.core.management.commands.seed_demo_data import Command as SeedDemoDataCommand
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inspections.disease_zone_profiles import (
    DISEASE_ZONE_PROFILES,
    ZONE_POLICY_CONSERVATIVE_WATCH_ZONE,
    ZONE_POLICY_EXPANDED_RISK_ZONE,
    ZONE_POLICY_LOCAL_RISK_ZONE,
    ZONE_POLICY_NO_ZONE,
    ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE,
    calculate_zone_radius_meters,
    get_disease_zone_profile,
    should_create_zone,
)
from apps.inspections.models import Inspection
from apps.inspections.serializers import InspectionCreateSerializer


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


class DiseaseZoneProfileTests(TestCase):
    def test_profiles_cover_current_ai_disease_classes(self):
        expected_profiles = {
            "anthracnose",
            "bacterial_spot",
            "blossom_end_rot",
            "catfaced",
            "fruit_cracking",
            "healthy",
            "late_blight",
            "mold",
            "spotted_wilt_virus",
            "target_spot",
            "bushy_stunt",
            "early_blight",
            "leaf_curl",
        }

        self.assertEqual(set(DISEASE_ZONE_PROFILES), expected_profiles)

    def test_no_zone_profiles_never_create_risk_zones(self):
        no_zone_profiles = {
            "healthy",
            "blossom_end_rot",
            "catfaced",
            "fruit_cracking",
        }

        for profile_key in no_zone_profiles:
            with self.subTest(profile_key=profile_key):
                profile = DISEASE_ZONE_PROFILES[profile_key]

                self.assertEqual(profile.zone_policy, ZONE_POLICY_NO_ZONE)
                self.assertFalse(should_create_zone(profile, has_valid_coordinates=True))
                self.assertEqual(
                    calculate_zone_radius_meters(
                        profile,
                        confidence_score=0.99,
                        signal_count=5,
                        latest_signal_at=timezone.now(),
                    ),
                    0,
                )

    def test_zone_creating_profiles_have_disease_specific_policies(self):
        expected_policies = {
            "anthracnose": ZONE_POLICY_LOCAL_RISK_ZONE,
            "bacterial_spot": ZONE_POLICY_LOCAL_RISK_ZONE,
            "early_blight": ZONE_POLICY_LOCAL_RISK_ZONE,
            "target_spot": ZONE_POLICY_LOCAL_RISK_ZONE,
            "mold": ZONE_POLICY_CONSERVATIVE_WATCH_ZONE,
            "late_blight": ZONE_POLICY_EXPANDED_RISK_ZONE,
            "spotted_wilt_virus": ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE,
            "leaf_curl": ZONE_POLICY_VECTOR_SURVEILLANCE_ZONE,
            "bushy_stunt": ZONE_POLICY_CONSERVATIVE_WATCH_ZONE,
        }

        for profile_key, expected_policy in expected_policies.items():
            with self.subTest(profile_key=profile_key):
                profile = DISEASE_ZONE_PROFILES[profile_key]

                self.assertEqual(profile.zone_policy, expected_policy)
                self.assertTrue(should_create_zone(profile, has_valid_coordinates=True))
                self.assertGreater(profile.base_radius_meters, 0)
                self.assertGreater(profile.max_radius_meters, profile.base_radius_meters)

    def test_alias_lookup_normalizes_labels_and_respects_organ_type(self):
        self.assertEqual(get_disease_zone_profile("Late Blight", "leaf").key, "late_blight")
        self.assertEqual(get_disease_zone_profile("late-blight", "fruit").key, "late_blight")
        self.assertEqual(get_disease_zone_profile("Tomato Leaf Curl Virus", "leaf").key, "leaf_curl")
        self.assertIsNone(get_disease_zone_profile("Anthracnose", "leaf"))
        self.assertIsNone(get_disease_zone_profile("unknown disease", "leaf"))

    def test_radius_formula_is_deterministic_and_uses_profile_radius(self):
        now = timezone.now()
        profile = DISEASE_ZONE_PROFILES["late_blight"]

        radius = calculate_zone_radius_meters(
            profile,
            confidence_score=0.9,
            signal_count=3,
            latest_signal_at=now - timedelta(hours=12),
            now=now,
        )

        self.assertEqual(radius, 112.12)

    def test_radius_formula_uses_recency_reduction_for_old_signals(self):
        now = timezone.now()
        profile = DISEASE_ZONE_PROFILES["early_blight"]

        radius = calculate_zone_radius_meters(
            profile,
            confidence_score=0.8,
            signal_count=1,
            latest_signal_at=now - timedelta(days=10),
            now=now,
        )

        self.assertEqual(radius, 23.38)

    def test_radius_is_zero_without_valid_coordinates(self):
        profile = DISEASE_ZONE_PROFILES["bacterial_spot"]

        self.assertFalse(should_create_zone(profile, has_valid_coordinates=False))
        self.assertEqual(
            calculate_zone_radius_meters(
                profile,
                confidence_score=0.95,
                signal_count=5,
                latest_signal_at=timezone.now(),
                has_valid_coordinates=False,
            ),
            0,
        )


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
        cls.early_blight = cls._create_disease("Early Blight")
        cls.late_blight = cls._create_disease("Late Blight")
        cls.healthy = cls._create_disease("Healthy")
        cls.blossom_end_rot = cls._create_disease("Blossom End Rot")

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
    def _create_disease(cls, name):
        return Disease.objects.create(name=name, slug=slugify(name))

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

    def test_no_zone_disease_is_signal_but_not_infection_zone(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(self.blossom_end_rot.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["disease_key"], "blossom_end_rot")
        self.assertEqual(response.data["signals"][0]["zone_policy"], ZONE_POLICY_NO_ZONE)
        self.assertEqual(response.data["infection_zones"], [])

    def test_infection_zone_generation_uses_disease_profile_and_centroid(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"disease": str(self.early_blight.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        zone = response.data["infection_zones"][0]

        self.assertTrue(zone["id"].startswith("zone-"))
        self.assertEqual(zone["disease_key"], "early_blight")
        self.assertEqual(zone["zone_policy"], ZONE_POLICY_LOCAL_RISK_ZONE)
        self.assertEqual(zone["severity"], "high")
        self.assertEqual(zone["center"]["latitude"], 34.13)
        self.assertEqual(zone["center"]["longitude"], -6.826)
        self.assertEqual(zone["radius_meters"], 41.33)

    def test_hierarchy_filter_limits_signals_by_line(self):
        response = self.client.get(
            reverse("inspection-map-signals"),
            {"line": str(self.other_line.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_signals"], 1)
        self.assertEqual(response.data["signals"][0]["line_id"], str(self.other_line.id))

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

