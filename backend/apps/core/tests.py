from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.catalog.models import Disease
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inspections.models import Inspection, InspectionMatch
from apps.review.models import Review


class SeedDemoDataCommandTests(APITestCase):
    def test_seed_demo_data_creates_minimal_records_without_duplicates(self):
        call_command("seed_demo_data")
        call_command("seed_demo_data")

        self.assertEqual(Role.objects.filter(name="admin").count(), 1)
        self.assertEqual(Role.objects.filter(name="operator").count(), 1)
        self.assertEqual(User.objects.filter(username="admin").count(), 1)
        self.assertEqual(Site.objects.filter(name="Demo Site").count(), 1)
        self.assertEqual(Greenhouse.objects.filter(name="Greenhouse A").count(), 1)
        self.assertEqual(Zone.objects.filter(name="Zone 1").count(), 1)
        self.assertEqual(Line.objects.filter(name="Default Line", code="default").count(), 1)
        self.assertEqual(Device.objects.filter(identifier="demo-device-001").count(), 1)
        self.assertEqual(ModelVersion.objects.filter(name="Tomato Similarity Model").count(), 1)
        self.assertEqual(
            InferenceIndex.objects.filter(name="fruit-demo-index", organ_type="fruit").count(),
            1,
        )
        self.assertEqual(
            InferenceIndex.objects.filter(name="leaf-demo-index", organ_type="leaf").count(),
            1,
        )
        self.assertEqual(Disease.objects.filter(organ_type=Disease.OrganType.FRUIT).count(), 10)
        self.assertEqual(Disease.objects.filter(organ_type=Disease.OrganType.LEAF).count(), 5)


class InspectionReviewFlowTests(APITestCase):
    def setUp(self):
        call_command("seed_demo_data")
        self.user = User.objects.get(username="admin")
        self.client.force_authenticate(user=self.user)
        self.device = Device.objects.get(identifier="demo-device-001")
        self.leaf_index = InferenceIndex.objects.get(
            name="leaf-demo-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )
        self.healthy_disease = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="healthy",
        )
        self.corrected_disease = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="early_blight",
        )

    def create_inspection(self, *, predicted_disease=None, top1_label="Healthy"):
        timestamp = timezone.now().replace(microsecond=0)

        inspection_response = self.client.post(
            reverse("inspection-list"),
            data={
                "device": str(self.device.id),
                "inference_index": str(self.leaf_index.id),
                "predicted_disease": (
                    str(predicted_disease.id) if predicted_disease is not None else None
                ),
                "organ_type": "leaf",
                "status": Inspection.Status.NEW,
                "processing_status": Inspection.ProcessingStatus.COMPLETED,
                "source_message_id": f"demo-message-{timestamp.timestamp()}",
                "top1_label": top1_label,
                "confidence_score": 0.97,
                "captured_at": timestamp.isoformat(),
                "received_at": timestamp.isoformat(),
                "processed_at": timestamp.isoformat(),
                "extra_metadata": {"source": "test"},
                "matches": [
                    {
                        "disease": str(self.healthy_disease.id),
                        "rank_order": 1,
                        "matched_label": "Healthy",
                        "similarity_score": 0.97,
                        "metadata_json": {"distance": 0.03},
                    },
                    {
                        "disease": str(self.corrected_disease.id),
                        "rank_order": 2,
                        "matched_label": "Early Blight",
                        "similarity_score": 0.76,
                        "metadata_json": {"distance": 0.24},
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(inspection_response.status_code, status.HTTP_201_CREATED)
        return Inspection.objects.get(pk=inspection_response.data["id"])

    def test_create_corrected_review_updates_inspection_prediction_and_status(self):
        inspection = self.create_inspection(predicted_disease=self.healthy_disease)
        self.assertEqual(inspection.device, self.device)
        self.assertEqual(inspection.inference_index, self.leaf_index)
        self.assertEqual(inspection.predicted_disease, self.healthy_disease)
        self.assertEqual(InspectionMatch.objects.filter(inspection=inspection).count(), 2)

        review_response = self.client.post(
            reverse("review-list"),
            data={
                "inspection": str(inspection.id),
                "decision": Review.Decision.CORRECTED,
                "corrected_disease": str(self.corrected_disease.id),
                "comments": "Reviewed and corrected after manual validation.",
            },
            format="json",
        )

        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(review_response.data["inspection"]), str(inspection.id))
        self.assertEqual(str(review_response.data["reviewer"]), str(self.user.id))
        self.assertEqual(
            str(review_response.data["corrected_disease"]),
            str(self.corrected_disease.id),
        )

        review = Review.objects.get(pk=review_response.data["id"])
        self.assertEqual(review.inspection, inspection)
        self.assertEqual(review.reviewer, self.user)
        self.assertEqual(review.corrected_disease, self.corrected_disease)

        inspection.refresh_from_db()
        self.assertEqual(inspection.status, Inspection.Status.REVIEWED)
        self.assertEqual(inspection.predicted_disease, self.corrected_disease)
        self.assertEqual(inspection.top1_label, self.corrected_disease.name)

    def test_create_accepted_review_marks_inspection_reviewed_without_changing_prediction(self):
        inspection = self.create_inspection(predicted_disease=self.healthy_disease)

        review_response = self.client.post(
            reverse("review-list"),
            data={
                "inspection": str(inspection.id),
                "decision": Review.Decision.ACCEPTED,
                "comments": "Prediction accepted.",
            },
            format="json",
        )

        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)

        inspection.refresh_from_db()
        self.assertEqual(inspection.status, Inspection.Status.REVIEWED)
        self.assertEqual(inspection.predicted_disease, self.healthy_disease)
        self.assertEqual(inspection.top1_label, "Healthy")

    def test_create_rejected_review_marks_inspection_reviewed_without_changing_prediction(self):
        inspection = self.create_inspection(predicted_disease=self.healthy_disease)

        review_response = self.client.post(
            reverse("review-list"),
            data={
                "inspection": str(inspection.id),
                "decision": Review.Decision.REJECTED,
                "comments": "Prediction rejected after review.",
            },
            format="json",
        )

        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)

        inspection.refresh_from_db()
        self.assertEqual(inspection.status, Inspection.Status.REVIEWED)
        self.assertEqual(inspection.predicted_disease, self.healthy_disease)
        self.assertEqual(inspection.top1_label, "Healthy")
