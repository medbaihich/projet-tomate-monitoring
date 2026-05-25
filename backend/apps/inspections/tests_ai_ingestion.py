from datetime import timedelta

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.core.management.commands.seed_demo_data import Command as SeedDemoDataCommand
from apps.devices.models import Device
from apps.inspections.evidence_commands import EvidenceImageCommandPublishResult
from apps.inspections.models import EvidenceImageRequest, Inspection, InspectionMatch
from apps.notifications.models import Notification
from apps.review.models import Review


@override_settings(AI_WORKER_INGESTION_TOKEN="phase6-test-token")
class AIResultIngestionApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        SeedDemoDataCommand().handle()
        cls.device = Device.objects.get(identifier="demo-device-001")
        cls.url = reverse("inspection-ingest-ai-result")
        cls.now = timezone.now().replace(microsecond=0)

    def _build_payload(self, **overrides):
        payload = {
            "schema_version": "ai-worker-result.v1",
            "message_type": "ai_inference_result",
            "source_schema_version": "raspberry-edge-payload.v1",
            "source_message_id": "phase6-ingest-001",
            "device_identifier": self.device.identifier,
            "captured_at": self.now.isoformat().replace("+00:00", "Z"),
            "received_at": (self.now + timedelta(seconds=1)).isoformat().replace("+00:00", "Z"),
            "processed_at": (self.now + timedelta(seconds=2)).isoformat().replace("+00:00", "Z"),
            "feature_model": "MobileNetV2_TFLite",
            "feature_dim": 1280,
            "l2_normalized": True,
            "declared_vector_norm": 1.0,
            "input_vector_norm": 1.0,
            "normalized_vector_norm": 1.0,
            "organ_type": Inspection.OrganType.FRUIT,
            "organ_confidence": 0.96,
            "organ_status": "routed",
            "top1_label": "late_blight",
            "top1_score": 0.91,
            "confidence_score": 0.91,
            "confidence_score_kind": "similarity",
            "majority_label": "late_blight",
            "final_label": "late_blight",
            "index_used": "fruit_faiss.index",
            "metadata_used": "fruit_metadata.csv",
            "matches": [
                {
                    "rank_order": 1,
                    "matched_label": "late_blight",
                    "similarity_score": 0.91,
                    "metadata_json": {"source_row": 1},
                },
                {
                    "rank_order": 2,
                    "matched_label": "healthy",
                    "similarity_score": 0.72,
                    "metadata_json": {"source_row": 2},
                },
            ],
            "processing_status": "processed",
            "requires_review": True,
            "warnings": [],
            "skip_reasons": [],
            "extra_metadata": {
                "routing_key": "tomato.edge.v1.demo-device-001.feature-vector",
                "image_id": "fruit-001",
            },
        }
        payload.update(overrides)
        return payload

    def _post(self, payload, *, token="phase6-test-token"):
        return self.client.post(
            self.url,
            data=payload,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_ingestion_creates_inspection_matches_and_notification(self):
        response = self._post(self._build_payload())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["created"], True)
        self.assertEqual(response.data["duplicate"], False)
        inspection = Inspection.objects.get(source_message_id="phase6-ingest-001")
        self.assertEqual(inspection.device, self.device)
        self.assertEqual(inspection.organ_type, Inspection.OrganType.FRUIT)
        self.assertEqual(inspection.processing_status, Inspection.ProcessingStatus.COMPLETED)
        self.assertEqual(inspection.top1_label, "late_blight")
        self.assertEqual(inspection.predicted_disease.ai_label, "late_blight")
        self.assertEqual(inspection.matches.count(), 2)
        self.assertEqual(
            list(inspection.matches.values_list("rank_order", flat=True)),
            [1, 2],
        )
        self.assertTrue(inspection.extra_metadata["ai_result"]["requires_review"])
        self.assertEqual(Notification.objects.filter(inspection=inspection).count(), 1)
        self.assertEqual(Review.objects.filter(inspection=inspection).count(), 0)
        evidence_request = EvidenceImageRequest.objects.get(inspection=inspection)
        self.assertEqual(evidence_request.device, self.device)
        self.assertEqual(evidence_request.source_message_id, inspection.source_message_id)
        self.assertEqual(evidence_request.image_id, "fruit-001")
        self.assertEqual(
            evidence_request.reason,
            EvidenceImageRequest.Reason.REVIEW_REQUIRED,
        )
        self.assertEqual(evidence_request.status, EvidenceImageRequest.Status.PENDING)

    @override_settings(EVIDENCE_IMAGE_COMMANDS_ENABLED=True)
    def test_ingestion_publishes_evidence_command_for_new_review_required_request(self):
        publish_result = EvidenceImageCommandPublishResult(
            published=True,
            exchange="amq.topic",
            routing_key=f"tomato.edge.v1.{self.device.identifier}.commands.image-request",
            payload={},
        )

        with patch(
            "apps.inspections.services.publish_evidence_image_request_command",
            return_value=publish_result,
        ) as publish_mock:
            response = self._post(
                self._build_payload(source_message_id="phase6-ingest-publish-once")
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        publish_mock.assert_called_once()
        published_request = publish_mock.call_args.kwargs["evidence_request"]
        self.assertEqual(
            published_request.source_message_id,
            "phase6-ingest-publish-once",
        )
        self.assertEqual(published_request.device.identifier, self.device.identifier)

    def test_ingestion_is_idempotent_by_source_message_id(self):
        first_response = self._post(self._build_payload())
        second_response = self._post(
            self._build_payload(confidence_score=0.55, top1_label="healthy")
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data["created"], False)
        self.assertEqual(second_response.data["duplicate"], True)
        self.assertEqual(Inspection.objects.filter(source_message_id="phase6-ingest-001").count(), 1)
        self.assertEqual(
            InspectionMatch.objects.filter(
                inspection__source_message_id="phase6-ingest-001"
            ).count(),
            2,
        )
        self.assertEqual(
            EvidenceImageRequest.objects.filter(source_message_id="phase6-ingest-001").count(),
            1,
        )

    @override_settings(EVIDENCE_IMAGE_COMMANDS_ENABLED=True)
    def test_duplicate_ingestion_replay_does_not_publish_command_again(self):
        publish_result = EvidenceImageCommandPublishResult(
            published=True,
            exchange="amq.topic",
            routing_key=f"tomato.edge.v1.{self.device.identifier}.commands.image-request",
            payload={},
        )

        with patch(
            "apps.inspections.services.publish_evidence_image_request_command",
            return_value=publish_result,
        ) as publish_mock:
            first_response = self._post(
                self._build_payload(source_message_id="phase6-ingest-publish-duplicate")
            )
            second_response = self._post(
                self._build_payload(
                    source_message_id="phase6-ingest-publish-duplicate",
                    confidence_score=0.55,
                    top1_label="healthy",
                )
            )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        publish_mock.assert_called_once()

    def test_unknown_device_is_rejected_without_creating_inspection(self):
        response = self._post(
            self._build_payload(
                source_message_id="phase6-unknown-device",
                device_identifier="missing-device-001",
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("device_identifier", response.data)
        self.assertFalse(
            Inspection.objects.filter(source_message_id="phase6-unknown-device").exists()
        )

    def test_invalid_token_is_rejected(self):
        response = self._post(
            self._build_payload(source_message_id="phase6-invalid-token"),
            token="wrong-token",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            Inspection.objects.filter(source_message_id="phase6-invalid-token").exists()
        )

    def test_healthy_ingestion_without_review_does_not_create_evidence_request(self):
        response = self._post(
            self._build_payload(
                source_message_id="phase6-healthy-no-evidence",
                organ_type=Inspection.OrganType.LEAF,
                top1_label="healthy",
                final_label="healthy",
                confidence_score=0.84,
                index_used="leaf_faiss.index",
                metadata_used="leaf_metadata.csv",
                requires_review=False,
                matches=[
                    {
                        "rank_order": 1,
                        "matched_label": "healthy",
                        "similarity_score": 0.84,
                        "metadata_json": {"source_row": 1},
                    }
                ],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection = Inspection.objects.get(source_message_id="phase6-healthy-no-evidence")
        self.assertFalse(
            EvidenceImageRequest.objects.filter(inspection=inspection).exists()
        )

    @override_settings(EVIDENCE_IMAGE_COMMANDS_ENABLED=True)
    def test_publish_failure_does_not_fail_ingestion_and_request_stays_pending(self):
        with patch(
            "apps.inspections.services.publish_evidence_image_request_command",
            side_effect=RuntimeError("rabbitmq unavailable"),
        ):
            response = self._post(
                self._build_payload(source_message_id="phase6-publish-failure")
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection = Inspection.objects.get(source_message_id="phase6-publish-failure")
        evidence_request = EvidenceImageRequest.objects.get(inspection=inspection)
        self.assertEqual(evidence_request.status, EvidenceImageRequest.Status.PENDING)
        self.assertEqual(
            evidence_request.response_metadata["command_publish"]["status"],
            "publish_failed",
        )
        self.assertIn(
            "rabbitmq unavailable",
            evidence_request.response_metadata["command_publish"]["error"],
        )
