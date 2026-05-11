from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import Role, User
from apps.catalog.models import Disease
from apps.devices.models import Device
from apps.inference.models import InferenceIndex
from apps.inspections.models import Inspection
from apps.notifications.models import Notification, NotificationUserState
from apps.notifications.services import maybe_create_disease_alert_notification


class NotificationFixtureMixin:
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo_data")
        cls.user = User.objects.get(username="admin")
        operator_role = Role.objects.get(name="operator")
        cls.other_user = User.objects.create_user(
            username="operator-user",
            password="operator1234",
            role=operator_role,
        )
        cls.device = Device.objects.get(identifier="demo-device-001")
        cls.fruit_index = InferenceIndex.objects.get(
            name="fruit-demo-index",
            organ_type=InferenceIndex.OrganType.FRUIT,
        )
        cls.leaf_index = InferenceIndex.objects.get(
            name="leaf-demo-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )
        cls.fruit_healthy_disease = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="healthy",
        )
        cls.healthy_disease = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="healthy",
        )
        cls.early_blight = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="early_blight",
        )

    def create_inspection_payload(
        self,
        *,
        predicted_disease,
        top1_label,
        processing_status=Inspection.ProcessingStatus.COMPLETED,
        organ_type=Inspection.OrganType.LEAF,
        inference_index=None,
    ):
        now = timezone.now().replace(microsecond=0)
        active_inference_index = inference_index or self.leaf_index
        return {
            "device": str(self.device.id),
            "inference_index": str(active_inference_index.id),
            "predicted_disease": str(predicted_disease.id) if predicted_disease else None,
            "organ_type": organ_type,
            "status": Inspection.Status.NEW,
            "processing_status": processing_status,
            "source_message_id": f"notification-test-{now.timestamp()}",
            "top1_label": top1_label,
            "confidence_score": 0.91,
            "captured_at": now.isoformat(),
            "received_at": now.isoformat(),
            "processed_at": now.isoformat(),
            "extra_metadata": {"source": "tests"},
            "matches": [
                {
                    "disease": str(predicted_disease.id) if predicted_disease else None,
                    "rank_order": 1,
                    "matched_label": top1_label,
                    "similarity_score": 0.91,
                    "metadata_json": {"distance": 0.09},
                }
            ],
        }

    def create_inspection_model(
        self,
        *,
        predicted_disease,
        top1_label,
        processing_status=Inspection.ProcessingStatus.COMPLETED,
        organ_type=Inspection.OrganType.LEAF,
        inference_index=None,
    ):
        now = timezone.now().replace(microsecond=0)
        active_inference_index = inference_index or self.leaf_index
        return Inspection.objects.create(
            device=self.device,
            inference_index=active_inference_index,
            predicted_disease=predicted_disease,
            organ_type=organ_type,
            status=Inspection.Status.NEW,
            processing_status=processing_status,
            source_message_id=f"service-notification-test-{now.timestamp()}",
            top1_label=top1_label,
            confidence_score=0.91,
            captured_at=now,
            received_at=now,
            processed_at=now + timedelta(minutes=1),
            extra_metadata={"source": "service-tests"},
        )


class NotificationInspectionTriggerTests(NotificationFixtureMixin, APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_creates_notification_for_disease_positive_completed_inspection(self):
        response = self.client.post(
            reverse("inspection-list"),
            data=self.create_inspection_payload(
                predicted_disease=self.early_blight,
                top1_label=self.early_blight.name,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.count(), 1)

        notification = Notification.objects.select_related("inspection", "disease").get()
        self.assertEqual(notification.event_type, Notification.EventType.DISEASE_ALERT)
        self.assertEqual(notification.disease, self.early_blight)
        self.assertEqual(notification.display_disease_label, self.early_blight.name)
        self.assertEqual(str(notification.inspection_id), response.data["id"])
        self.assertFalse(notification.is_read)
        self.assertEqual(NotificationUserState.objects.count(), 0)

    def test_does_not_create_notification_for_healthy_completed_inspection(self):
        response = self.client.post(
            reverse("inspection-list"),
            data=self.create_inspection_payload(
                predicted_disease=self.healthy_disease,
                top1_label=self.healthy_disease.name,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.count(), 0)

    def test_does_not_create_notification_for_fruit_healthy_completed_inspection(self):
        response = self.client.post(
            reverse("inspection-list"),
            data=self.create_inspection_payload(
                predicted_disease=self.fruit_healthy_disease,
                top1_label=self.fruit_healthy_disease.name,
                organ_type=Inspection.OrganType.FRUIT,
                inference_index=self.fruit_index,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.count(), 0)

    def test_does_not_create_notification_for_non_completed_pathological_inspection(self):
        response = self.client.post(
            reverse("inspection-list"),
            data=self.create_inspection_payload(
                predicted_disease=self.early_blight,
                top1_label=self.early_blight.name,
                processing_status=Inspection.ProcessingStatus.PENDING,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.count(), 0)

    def test_transition_from_non_alert_to_alert_creates_one_notification(self):
        create_response = self.client.post(
            reverse("inspection-list"),
            data=self.create_inspection_payload(
                predicted_disease=self.healthy_disease,
                top1_label=self.healthy_disease.name,
            ),
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.count(), 0)

        update_response = self.client.patch(
            reverse("inspection-detail", args=[create_response.data["id"]]),
            data={
                "predicted_disease": str(self.early_blight.id),
                "top1_label": self.early_blight.name,
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.count(), 1)

        repeat_response = self.client.patch(
            reverse("inspection-detail", args=[create_response.data["id"]]),
            data={"top1_label": "Early Blight Confirmed"},
            format="json",
        )

        self.assertEqual(repeat_response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.count(), 1)


class NotificationServiceTests(NotificationFixtureMixin, TestCase):
    def test_persists_before_broadcast_callback_runs(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.early_blight,
            top1_label=self.early_blight.name,
        )

        observed = {}

        def fake_on_commit(callback):
            observed["count_before_broadcast"] = Notification.objects.count()
            callback()

        with patch("apps.notifications.services.transaction.on_commit", side_effect=fake_on_commit):
            with patch("apps.notifications.services._broadcast_notification_by_id") as broadcast_mock:
                notification, created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(created)
        self.assertEqual(observed["count_before_broadcast"], 1)
        broadcast_mock.assert_called_once_with(notification.id)

    def test_deduplicates_same_alert_event_for_same_inspection(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.early_blight,
            top1_label=self.early_blight.name,
        )

        with patch("apps.notifications.services.transaction.on_commit", side_effect=lambda callback: callback()):
            with patch("apps.notifications.services._broadcast_notification_by_id"):
                first_notification, first_created = maybe_create_disease_alert_notification(inspection)
                second_notification, second_created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first_notification.id, second_notification.id)
        self.assertEqual(Notification.objects.count(), 1)


class NotificationApiTests(NotificationFixtureMixin, APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.other_client = APIClient()
        self.other_client.force_authenticate(user=self.other_user)
        self.notification = Notification.objects.create(
            inspection=self.create_inspection_model(
                predicted_disease=self.early_blight,
                top1_label=self.early_blight.name,
            ),
            disease=self.early_blight,
            event_type=Notification.EventType.DISEASE_ALERT,
            severity=Notification.Severity.HIGH,
            title="Disease alert detected",
            message="A disease-positive inspection was detected.",
            display_disease_label=self.early_blight.name,
            confidence_score=0.91,
            payload={"device_identifier": self.device.identifier},
        )

    def test_two_users_see_same_shared_notification_feed(self):
        response = self.client.get(reverse("notification-list"))
        other_response = self.other_client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(other_response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], other_response.data["results"][0]["id"])
        self.assertFalse(response.data["results"][0]["is_read"])
        self.assertFalse(other_response.data["results"][0]["is_read"])

    def test_one_user_marking_read_does_not_affect_other_user(self):
        response = self.client.post(
            reverse("notification-mark-read", args=[self.notification.id]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])
        self.assertIsNotNone(response.data["read_at"])

        state = NotificationUserState.objects.get(user=self.user, notification=self.notification)
        self.assertTrue(state.is_read)
        self.assertIsNotNone(state.read_at)

        self.notification.refresh_from_db()
        self.assertFalse(self.notification.is_read)
        self.assertIsNone(self.notification.read_at)

        other_response = self.other_client.get(reverse("notification-list"))
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        self.assertFalse(other_response.data["results"][0]["is_read"])

    def test_unread_filter_is_resolved_per_user(self):
        self.client.post(
            reverse("notification-mark-read", args=[self.notification.id]),
            format="json",
        )

        user_unread = self.client.get(reverse("notification-list"), {"is_read": "false"})
        other_user_unread = self.other_client.get(
            reverse("notification-list"),
            {"is_read": "false"},
        )

        self.assertEqual(user_unread.status_code, status.HTTP_200_OK)
        self.assertEqual(other_user_unread.status_code, status.HTTP_200_OK)
        self.assertEqual(user_unread.data["count"], 0)
        self.assertEqual(other_user_unread.data["count"], 1)

    def test_mark_all_read_affects_only_current_user(self):
        second_notification = Notification.objects.create(
            inspection=self.create_inspection_model(
                predicted_disease=self.early_blight,
                top1_label="Early Blight Repeat",
            ),
            disease=self.early_blight,
            event_type=Notification.EventType.DISEASE_ALERT,
            severity=Notification.Severity.MEDIUM,
            title="Disease alert detected",
            message="Another disease-positive inspection was detected.",
            display_disease_label=self.early_blight.name,
            confidence_score=0.82,
            payload={"device_identifier": self.device.identifier},
        )

        response = self.client.post(reverse("notification-mark-all-read"), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_count"], 2)

        self.assertEqual(
            NotificationUserState.objects.filter(user=self.user, is_read=True).count(),
            2,
        )
        self.assertEqual(
            NotificationUserState.objects.filter(user=self.other_user).count(),
            0,
        )

        user_unread = self.client.get(reverse("notification-list"), {"is_read": "false"})
        other_user_unread = self.other_client.get(
            reverse("notification-list"),
            {"is_read": "false"},
        )

        self.assertEqual(user_unread.data["count"], 0)
        self.assertEqual(other_user_unread.data["count"], 2)

