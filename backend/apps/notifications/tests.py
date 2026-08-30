import json
from datetime import timedelta
from unittest.mock import patch
from uuid import UUID, uuid4

from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
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
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import (
    NOTIFICATIONS_GROUP_NAME,
    maybe_create_disease_alert_notification,
    maybe_create_review_required_notification,
    schedule_dashboard_refresh_event,
)


def assert_json_safe_primitive(testcase, value, *, path="root"):
    testcase.assertNotIsInstance(value, UUID, f"{path} should not contain UUID instances")

    if isinstance(value, dict):
        for key, item in value.items():
            testcase.assertIsInstance(key, str, f"{path} keys must be strings")
            assert_json_safe_primitive(testcase, item, path=f"{path}.{key}")
        return

    if isinstance(value, list):
        for index, item in enumerate(value):
            assert_json_safe_primitive(testcase, item, path=f"{path}[{index}]")
        return

    testcase.assertTrue(
        value is None or isinstance(value, (str, int, float, bool)),
        f"{path} is not JSON-safe: {type(value).__name__}",
    )


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
        cls.leaf_late_blight = Disease.objects.get(
            organ_type=Disease.OrganType.LEAF,
            ai_label="late_blight",
        )
        cls.fruit_blossom_end_rot = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="blossom_end_rot",
        )
        cls.fruit_catfaced = Disease.objects.get(
            organ_type=Disease.OrganType.FRUIT,
            ai_label="catfaced",
        )

    def create_inspection_payload(
        self,
        *,
        predicted_disease,
        top1_label,
        processing_status=Inspection.ProcessingStatus.COMPLETED,
        organ_type=Inspection.OrganType.LEAF,
        inference_index=None,
        confidence_score=0.91,
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
            "source_message_id": f"notification-test-{now.timestamp()}-{uuid4().hex}",
            "top1_label": top1_label,
            "confidence_score": confidence_score,
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
        confidence_score=0.91,
        processing_status=Inspection.ProcessingStatus.COMPLETED,
        organ_type=Inspection.OrganType.LEAF,
        inference_index=None,
        extra_metadata=None,
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
            source_message_id=f"service-notification-test-{now.timestamp()}-{uuid4().hex}",
            top1_label=top1_label,
            confidence_score=confidence_score,
            captured_at=now,
            received_at=now,
            processed_at=now + timedelta(minutes=1),
            extra_metadata=extra_metadata or {"source": "service-tests"},
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

    def test_creates_review_required_notification_for_completed_inspection_under_70_confidence(self):
        with patch("apps.notifications.services._broadcast_dashboard_refresh"):
            response = self.client.post(
                reverse("inspection-list"),
                data=self.create_inspection_payload(
                    predicted_disease=self.healthy_disease,
                    top1_label=self.healthy_disease.name,
                    confidence_score=0.69,
                ),
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.count(), 1)

        notification = Notification.objects.select_related("inspection", "disease").get()
        self.assertEqual(notification.event_type, Notification.EventType.REVIEW_REQUIRED)
        self.assertEqual(notification.disease, self.healthy_disease)
        self.assertEqual(notification.severity, Notification.Severity.MEDIUM)
        self.assertEqual(notification.confidence_score, 0.69)
        self.assertEqual(notification.payload["review_reason"], "confidence_below_threshold")
        self.assertEqual(notification.payload["review_threshold"], 0.70)
        self.assertIn("below the 70% threshold", notification.message)

    def test_does_not_create_review_required_notification_at_70_confidence(self):
        response = self.client.post(
            reverse("inspection-list"),
            data=self.create_inspection_payload(
                predicted_disease=self.healthy_disease,
                top1_label=self.healthy_disease.name,
                confidence_score=0.70,
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
    class CaptureChannelLayer:
        def __init__(self):
            self.sent_messages = []

        async def group_send(self, group, message):
            self.sent_messages.append((group, message))

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

    def test_deduplicates_same_review_required_event_for_same_inspection(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.healthy_disease,
            top1_label=self.healthy_disease.name,
            confidence_score=0.42,
        )

        with patch("apps.notifications.services.transaction.on_commit", side_effect=lambda callback: callback()):
            with patch("apps.notifications.services._broadcast_notification_by_id"):
                with patch("apps.notifications.services._broadcast_dashboard_refresh"):
                    first_notification, first_created = maybe_create_review_required_notification(inspection)
                    second_notification, second_created = maybe_create_review_required_notification(inspection)

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first_notification.id, second_notification.id)
        self.assertEqual(first_notification.event_type, Notification.EventType.REVIEW_REQUIRED)
        self.assertEqual(Notification.objects.count(), 1)

    def test_notification_serializer_representation_is_json_safe(self):
        notification = Notification.objects.create(
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

        serialized = NotificationSerializer(notification).data

        self.assertEqual(serialized["id"], str(notification.id))
        self.assertEqual(serialized["inspection"], str(notification.inspection_id))
        self.assertEqual(serialized["disease"], str(notification.disease_id))
        assert_json_safe_primitive(self, serialized)
        json.dumps(serialized)

    def test_disease_positive_notification_broadcast_payload_is_json_safe(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.early_blight,
            top1_label=self.early_blight.name,
        )
        channel_layer = self.CaptureChannelLayer()

        with patch("apps.notifications.services.transaction.on_commit", side_effect=lambda callback: callback()):
            with patch("apps.notifications.services.get_channel_layer", return_value=channel_layer):
                notification, created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(created)
        self.assertEqual(len(channel_layer.sent_messages), 1)

        group_name, event = channel_layer.sent_messages[0]
        self.assertEqual(group_name, NOTIFICATIONS_GROUP_NAME)
        self.assertEqual(event["type"], "notification.created")
        self.assertEqual(event["notification"]["id"], str(notification.id))
        self.assertEqual(event["notification"]["inspection"], str(notification.inspection_id))
        self.assertEqual(event["notification"]["disease"], str(notification.disease_id))
        assert_json_safe_primitive(self, event)
        json.dumps(event)

    def test_dashboard_refresh_event_schedules_and_broadcasts_json_safe_payload(self):
        channel_layer = self.CaptureChannelLayer()

        with patch("apps.notifications.services.transaction.on_commit", side_effect=lambda callback: callback()):
            with patch("apps.notifications.services.get_channel_layer", return_value=channel_layer):
                schedule_dashboard_refresh_event("inspection.created")

        self.assertEqual(len(channel_layer.sent_messages), 1)

        group_name, event = channel_layer.sent_messages[0]
        self.assertEqual(group_name, NOTIFICATIONS_GROUP_NAME)
        self.assertEqual(event["type"], "dashboard.refresh")
        self.assertEqual(event["reason"], "inspection.created")
        assert_json_safe_primitive(self, event)
        json.dumps(event)


@override_settings(
    EMAIL_NOTIFICATIONS_ENABLED=True,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    ALERT_EMAIL_RECIPIENTS=["alerts@example.com"],
    REVIEW_EMAIL_RECIPIENTS=["review@example.com"],
    FRONTEND_BASE_URL="https://frontend.example.com",
)
class NotificationEmailServiceTests(NotificationFixtureMixin, TestCase):
    def setUp(self):
        mail.outbox = []

    def test_disease_alert_email_uses_catalog_critical_risk_even_when_confidence_is_low(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.leaf_late_blight,
            top1_label=self.leaf_late_blight.name,
            confidence_score=0.55,
        )

        with patch("apps.notifications.services._broadcast_notification_by_id"):
            with self.captureOnCommitCallbacks(execute=True):
                notification, created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(created)
        self.assertEqual(notification.severity, Notification.Severity.CRITICAL)
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertEqual(
            email.subject,
            f"[SMART EYE][CRITICAL] Alerte maladie tomate - {self.leaf_late_blight.name}",
        )
        self.assertIn(
            "Intervention immédiate requise. Une alerte critique a été détectée.",
            email.body,
        )
        self.assertIn("Confiance : 55%", email.body)
        self.assertTrue(email.alternatives)
        self.assertIn("#7e22ce", email.alternatives[0][0])

    def test_disease_alert_email_uses_catalog_low_risk_even_when_confidence_is_high(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.fruit_catfaced,
            top1_label=self.fruit_catfaced.name,
            confidence_score=0.97,
            organ_type=Inspection.OrganType.FRUIT,
            inference_index=self.fruit_index,
        )

        with patch("apps.notifications.services._broadcast_notification_by_id"):
            with self.captureOnCommitCallbacks(execute=True):
                notification, created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(created)
        self.assertEqual(notification.severity, Notification.Severity.LOW)
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertEqual(
            email.subject,
            f"[SMART EYE][LOW] Alerte maladie tomate - {self.fruit_catfaced.name}",
        )
        self.assertIn(
            "Alerte faible détectée. Une surveillance est recommandée.",
            email.body,
        )
        self.assertIn("Confiance : 97%", email.body)
        self.assertTrue(email.alternatives)
        self.assertIn("#ca8a04", email.alternatives[0][0])

    def test_disease_alert_email_falls_back_to_confidence_when_no_catalog_profile_exists(self):
        suffix = uuid4().hex[:8]
        fallback_disease = Disease.objects.create(
            organ_type=Disease.OrganType.LEAF,
            ai_label=f"fallback_notification_{suffix}",
            name="Fallback Notification Disease",
            slug=f"fallback-notification-disease-{suffix}",
        )
        inspection = self.create_inspection_model(
            predicted_disease=fallback_disease,
            top1_label=fallback_disease.name,
            confidence_score=0.91,
        )

        with patch("apps.notifications.services._broadcast_notification_by_id"):
            with self.captureOnCommitCallbacks(execute=True):
                notification, created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(created)
        self.assertEqual(notification.severity, Notification.Severity.HIGH)
        self.assertEqual(len(mail.outbox), 1)

    def test_disease_alert_email_uses_expected_severity_message_and_color(self):
        cases = [
            (
                self.leaf_late_blight,
                Notification.Severity.CRITICAL,
                "Intervention immédiate requise. Une alerte critique a été détectée.",
                "#7e22ce",
            ),
            (
                self.early_blight,
                Notification.Severity.HIGH,
                "Alerte élevée détectée. Une vérification rapide est recommandée",
                "#dc2626",
            ),
            (
                self.fruit_blossom_end_rot,
                Notification.Severity.MEDIUM,
                "Alerte moyenne détectée. Merci de consulter l’inspection",
                "#ea580c",
            ),
            (
                self.fruit_catfaced,
                Notification.Severity.LOW,
                "Alerte faible détectée. Une surveillance est recommandée.",
                "#ca8a04",
            ),
        ]

        for disease, expected_severity, expected_message, expected_color in cases:
            with self.subTest(disease=disease.ai_label, severity=expected_severity):
                mail.outbox = []
                organ_type = (
                    Inspection.OrganType.FRUIT
                    if disease.organ_type == Disease.OrganType.FRUIT
                    else Inspection.OrganType.LEAF
                )
                inference_index = (
                    self.fruit_index if organ_type == Inspection.OrganType.FRUIT else self.leaf_index
                )
                inspection = self.create_inspection_model(
                    predicted_disease=disease,
                    top1_label=disease.name,
                    confidence_score=0.81,
                    organ_type=organ_type,
                    inference_index=inference_index,
                )

                with patch("apps.notifications.services._broadcast_notification_by_id"):
                    with self.captureOnCommitCallbacks(execute=True):
                        notification, created = maybe_create_disease_alert_notification(inspection)

                self.assertTrue(created)
                self.assertEqual(notification.severity, expected_severity)
                self.assertEqual(len(mail.outbox), 1)

                email = mail.outbox[0]
                self.assertEqual(
                    email.subject,
                    f"[SMART EYE][{expected_severity.upper()}] Alerte maladie tomate - {disease.name}",
                )
                self.assertIn(expected_message, email.body)
                self.assertIn("https://frontend.example.com/inspections", email.body)
                self.assertTrue(email.alternatives)
                self.assertIn(expected_color, email.alternatives[0][0])
                self.assertIn(expected_message, email.alternatives[0][0])

    def test_duplicate_alert_email_is_not_sent_twice_for_same_inspection(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.early_blight,
            top1_label=self.early_blight.name,
        )

        with patch("apps.notifications.services._broadcast_notification_by_id"):
            with self.captureOnCommitCallbacks(execute=True):
                first_notification, first_created = maybe_create_disease_alert_notification(inspection)
            with self.captureOnCommitCallbacks(execute=True):
                second_notification, second_created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first_notification.id, second_notification.id)
        self.assertEqual(len(mail.outbox), 1)

    def test_alert_email_failure_is_logged_without_breaking_notification_creation(self):
        inspection = self.create_inspection_model(
            predicted_disease=self.early_blight,
            top1_label=self.early_blight.name,
        )

        with patch("apps.notifications.services._broadcast_notification_by_id"):
            with patch(
                "apps.notifications.email_services._deliver_email_message",
                side_effect=RuntimeError("smtp unavailable"),
            ):
                with patch("apps.notifications.email_services.logger.exception") as logger_mock:
                    with self.captureOnCommitCallbacks(execute=True):
                        notification, created = maybe_create_disease_alert_notification(inspection)

        self.assertTrue(created)
        self.assertIsNotNone(notification)
        self.assertEqual(Notification.objects.count(), 1)
        logger_mock.assert_called_once()
        self.assertEqual(len(mail.outbox), 0)


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

