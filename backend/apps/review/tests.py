from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.catalog.models import Disease
from apps.devices.models import Device, Greenhouse, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inspections.models import Inspection
from apps.review.models import Review


class ReviewRolePermissionTests(APITestCase):
    def setUp(self):
        self.operator_role = Role.objects.create(name="operator", description="Operator role")
        self.operator_user = User.objects.create_user(
            username="review-operator",
            password="operator1234",
            role=self.operator_role,
        )
        self.site = Site.objects.create(name="Review Site", location="Farm")
        self.greenhouse = Greenhouse.objects.create(site=self.site, name="GH-1")
        self.zone = Zone.objects.create(greenhouse=self.greenhouse, name="Zone 1")
        self.device = Device.objects.create(
            zone=self.zone,
            name="Inspection Camera",
            identifier="inspection-camera-1",
        )
        self.model_version = ModelVersion.objects.create(
            name="Review Model",
            version="v1",
        )
        self.inference_index = InferenceIndex.objects.create(
            model_version=self.model_version,
            name="leaf-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )
        self.predicted_disease = Disease.objects.create(
            name="Target Spot",
            slug="target-spot",
        )
        self.corrected_disease = Disease.objects.create(
            name="Late Blight",
            slug="late-blight",
        )
        self.inspection = Inspection.objects.create(
            device=self.device,
            inference_index=self.inference_index,
            predicted_disease=self.predicted_disease,
            organ_type=Inspection.OrganType.LEAF,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id="review-permission-test",
            top1_label=self.predicted_disease.name,
            confidence_score=0.42,
            captured_at=timezone.now(),
            received_at=timezone.now(),
        )

    def test_operator_can_create_review(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.post(
            reverse("review-list"),
            {
                "inspection": str(self.inspection.id),
                "decision": Review.Decision.CORRECTED,
                "corrected_disease": str(self.corrected_disease.id),
                "comments": "Manual correction required.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Review.objects.count(), 1)
        review = Review.objects.get()
        self.assertEqual(review.reviewer, self.operator_user)

