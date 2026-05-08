from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import Role, User
from apps.catalog.models import Disease
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inspections.models import Inspection
from apps.notifications.models import Notification, NotificationUserState


class MonitoringApiTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="admin", description="Admin role")
        self.operator_role = Role.objects.create(name="operator", description="Operator role")
        self.admin_user = User.objects.create_user(
            username="monitor-admin",
            password="admin1234",
            role=self.admin_role,
            last_seen_at=timezone.now(),
        )
        self.operator_user = User.objects.create_user(
            username="monitor-operator",
            password="operator1234",
            role=self.operator_role,
            last_seen_at=timezone.now() - timedelta(minutes=2),
        )
        self.offline_user = User.objects.create_user(
            username="monitor-offline",
            password="offline1234",
            role=self.operator_role,
            last_seen_at=timezone.now() - timedelta(minutes=30),
        )

        self.client.force_authenticate(user=self.admin_user)
        self.operator_client = APIClient()
        self.operator_client.force_authenticate(user=self.operator_user)

        self.site = Site.objects.create(name="Monitor Site", location="Farm")
        self.greenhouse = Greenhouse.objects.create(site=self.site, name="GH-1")
        self.zone = Zone.objects.create(greenhouse=self.greenhouse, name="Zone 1")
        self.line = Line.objects.create(zone=self.zone, name="Line 1", code="line-1")
        self.device = Device.objects.create(
            line=self.line,
            name="Monitor Camera",
            identifier="monitor-camera-1",
        )
        self.model_version = ModelVersion.objects.create(name="Monitor Model", version="v1")
        self.inference_index = InferenceIndex.objects.create(
            model_version=self.model_version,
            name="leaf-monitor-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )
        self.disease = Disease.objects.create(name="Early Blight", slug="early-blight")
        self.inspection = Inspection.objects.create(
            device=self.device,
            inference_index=self.inference_index,
            predicted_disease=self.disease,
            organ_type=Inspection.OrganType.LEAF,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id="monitoring-test",
            top1_label=self.disease.name,
            confidence_score=0.93,
            captured_at=timezone.now(),
            received_at=timezone.now(),
        )
        self.notification = Notification.objects.create(
            inspection=self.inspection,
            disease=self.disease,
            event_type=Notification.EventType.DISEASE_ALERT,
            severity=Notification.Severity.HIGH,
            title="Disease alert detected",
            message="A disease-positive inspection was detected.",
            display_disease_label=self.disease.name,
            confidence_score=0.93,
            payload={"device_identifier": self.device.identifier},
        )
        NotificationUserState.objects.create(
            user=self.admin_user,
            notification=self.notification,
            is_read=True,
            read_at=timezone.now() - timedelta(minutes=1),
        )
        NotificationUserState.objects.create(
            user=self.operator_user,
            notification=self.notification,
            is_read=False,
        )

    def test_summary_endpoint_is_admin_only_and_returns_monitoring_snapshot(self):
        response = self.client.get(reverse("monitoring-summary"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_notifications"], 1)
        self.assertEqual(response.data["summary"]["notifications_with_reads"], 1)
        self.assertEqual(response.data["summary"]["active_user_count"], 2)
        self.assertEqual(len(response.data["latest_notifications"]), 1)
        self.assertEqual(len(response.data["recent_read_activity"]), 1)

        operator_response = self.operator_client.get(reverse("monitoring-summary"))
        self.assertEqual(operator_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_notification_activity_endpoint_exposes_read_metrics(self):
        response = self.client.get(reverse("monitoring-notification-activity"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        result = response.data["results"][0]
        self.assertEqual(result["id"], str(self.notification.id))
        self.assertEqual(result["read_user_count"], 1)
        self.assertEqual(result["unread_user_count"], 2)

    def test_notification_read_activity_and_readers_endpoints_expose_user_read_state(self):
        response = self.client.get(reverse("monitoring-notification-read-activity"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        read_event = response.data["results"][0]
        self.assertEqual(read_event["notification_id"], str(self.notification.id))
        self.assertEqual(read_event["user"]["username"], self.admin_user.username)
        self.assertTrue(read_event["is_read"])

        readers_response = self.client.get(
            reverse("monitoring-notification-readers", args=[self.notification.id])
        )
        self.assertEqual(readers_response.status_code, status.HTTP_200_OK)
        self.assertEqual(readers_response.data["count"], 1)

    def test_user_activity_endpoint_exposes_status_and_supports_status_filter(self):
        response = self.client.get(reverse("monitoring-user-activity"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)
        statuses = {item["username"]: item["status"] for item in response.data["results"]}
        self.assertEqual(statuses[self.admin_user.username], "active")
        self.assertEqual(statuses[self.operator_user.username], "active")
        self.assertEqual(statuses[self.offline_user.username], "offline")

        active_response = self.client.get(
            reverse("monitoring-user-activity"),
            {"status": "active"},
        )
        self.assertEqual(active_response.status_code, status.HTTP_200_OK)
        self.assertEqual(active_response.data["count"], 2)

    def test_authenticated_request_updates_last_seen_when_interval_elapsed(self):
        self.offline_user.last_seen_at = timezone.now() - timedelta(minutes=10)
        self.offline_user.save(update_fields=["last_seen_at"])

        activity_client = APIClient()
        activity_client.force_authenticate(user=self.offline_user)

        response = activity_client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.offline_user.refresh_from_db()
        self.assertIsNotNone(self.offline_user.last_seen_at)
        self.assertGreaterEqual(self.offline_user.last_seen_at, timezone.now() - timedelta(minutes=1))
