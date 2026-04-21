from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.core.management.commands.seed_demo_data import Command as SeedDemoDataCommand
from apps.devices.models import Device
from apps.inference.models import InferenceIndex
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

