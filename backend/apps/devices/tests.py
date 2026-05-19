from django.urls import reverse
from unittest.mock import patch
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.devices.models import Device, Greenhouse, Line, Site, Zone
from apps.inference.models import InferenceIndex, ModelVersion
from apps.inspections.models import Inspection


class DevicesRolePermissionTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="admin", description="Admin role")
        self.operator_role = Role.objects.create(name="operator", description="Operator role")
        self.admin_user = User.objects.create_user(
            username="devices-admin",
            password="admin1234",
            role=self.admin_role,
        )
        self.operator_user = User.objects.create_user(
            username="devices-operator",
            password="operator1234",
            role=self.operator_role,
        )
        self.site = Site.objects.create(name="Main Site", location="North Farm")
        self.greenhouse = Greenhouse.objects.create(site=self.site, name="GH-1")
        self.zone = Zone.objects.create(greenhouse=self.greenhouse, name="Zone 1")
        self.line = Line.objects.create(
            zone=self.zone,
            name="Line 1",
            code="line-1",
        )
        self.device = Device.objects.create(
            line=self.line,
            name="Camera Node 1",
            identifier="camera-node-1",
        )
        self.model_version = ModelVersion.objects.create(
            name="Devices Test Model",
            version="v1",
        )
        self.inference_index = InferenceIndex.objects.create(
            model_version=self.model_version,
            name="devices-test-leaf-index",
            organ_type=InferenceIndex.OrganType.LEAF,
        )

    def test_operator_can_read_device_list(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("device-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_operator_cannot_create_device(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.post(
            reverse("device-list"),
            {
                "line": str(self.line.id),
                "name": "Camera Node 2",
                "identifier": "camera-node-2",
                "description": "New camera",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_device(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("device-list"),
            {
                "line": str(self.line.id),
                "name": "Camera Node 2",
                "identifier": "camera-node-2",
                "description": "New camera",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Device.objects.filter(identifier="camera-node-2").exists())

    def test_admin_can_create_line_under_zone(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("line-list"),
            {
                "zone": str(self.zone.id),
                "name": "Line 2",
                "code": "line-2",
                "description": "Second line",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Line.objects.filter(zone=self.zone, code="line-2").exists())

    def test_line_list_supports_zone_filter(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("line-list"), {"zone": str(self.zone.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_site_hierarchy_returns_lines_with_devices(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("site-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        site = response.data["results"][0]
        zone = site["greenhouses"][0]["zones"][0]
        line = zone["lines"][0]

        self.assertEqual(line["id"], str(self.line.id))
        self.assertEqual(line["devices"][0]["id"], str(self.device.id))
        self.assertEqual(str(line["devices"][0]["line"]), str(self.line.id))

    def test_device_response_exposes_zone_context_through_line(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("device-detail", args=[self.device.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(str(response.data["line"]), str(self.line.id))
        self.assertEqual(response.data["line_name"], self.line.name)
        self.assertEqual(str(response.data["zone"]), str(self.zone.id))
        self.assertEqual(response.data["zone_name"], self.zone.name)
        self.assertEqual(str(response.data["greenhouse"]), str(self.greenhouse.id))
        self.assertEqual(response.data["greenhouse_name"], self.greenhouse.name)
        self.assertEqual(str(response.data["site"]), str(self.site.id))
        self.assertEqual(response.data["site_name"], self.site.name)
        self.assertIsNone(response.data["latitude"])
        self.assertIsNone(response.data["longitude"])
        self.assertIsNone(response.data["local_x"])
        self.assertIsNone(response.data["local_y"])
        self.assertIsNone(response.data["map_label"])

    def test_admin_can_create_device_with_optional_map_location_fields(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("device-list"),
            {
                "line": str(self.line.id),
                "name": "Camera Node 3",
                "identifier": "camera-node-3",
                "description": "Mapped camera",
                "latitude": 34.125,
                "longitude": -6.831,
                "local_x": 42.5,
                "local_y": 61.25,
                "map_label": "North row camera",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["latitude"], 34.125)
        self.assertEqual(response.data["longitude"], -6.831)
        self.assertEqual(response.data["local_x"], 42.5)
        self.assertEqual(response.data["local_y"], 61.25)
        self.assertEqual(response.data["map_label"], "North row camera")

    def test_device_location_rejects_invalid_latitude(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            reverse("device-detail", args=[self.device.id]),
            {"latitude": 120},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("latitude", response.data)

    def test_device_map_endpoint_returns_map_ready_shape(self):
        self.device.latitude = 34.125
        self.device.longitude = -6.831
        self.device.local_x = 42.5
        self.device.local_y = 61.25
        self.device.map_label = "North row camera"
        self.device.save()
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("device-map"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        device = response.data["results"][0]
        self.assertEqual(device["id"], str(self.device.id))
        self.assertEqual(device["name"], self.device.name)
        self.assertEqual(device["identifier"], self.device.identifier)
        self.assertEqual(device["latitude"], 34.125)
        self.assertEqual(device["longitude"], -6.831)
        self.assertEqual(device["local_x"], 42.5)
        self.assertEqual(device["local_y"], 61.25)
        self.assertEqual(device["map_label"], "North row camera")
        self.assertEqual(str(device["line"]), str(self.line.id))
        self.assertEqual(device["line_name"], self.line.name)
        self.assertEqual(str(device["zone"]), str(self.zone.id))
        self.assertEqual(device["zone_name"], self.zone.name)
        self.assertEqual(str(device["greenhouse"]), str(self.greenhouse.id))
        self.assertEqual(device["greenhouse_name"], self.greenhouse.name)
        self.assertEqual(str(device["site"]), str(self.site.id))
        self.assertEqual(device["site_name"], self.site.name)
        self.assertTrue(device["has_location"])

    def test_device_map_endpoint_supports_hierarchy_and_location_filters(self):
        Device.objects.create(
            line=self.line,
            name="Camera Node 2",
            identifier="camera-node-2",
        )
        self.device.latitude = 34.125
        self.device.longitude = -6.831
        self.device.save()
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(
            reverse("device-map"),
            {
                "site": str(self.site.id),
                "greenhouse": str(self.greenhouse.id),
                "zone": str(self.zone.id),
                "line": str(self.line.id),
                "has_location": "true",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(self.device.id))

    def test_device_list_supports_compatible_zone_filter(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("device-list"), {"zone": str(self.zone.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_device_list_supports_line_filter(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("device-list"), {"line": str(self.line.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_device_create_emits_dashboard_refresh_event(self):
        self.client.force_authenticate(user=self.admin_user)

        with patch("apps.devices.views.schedule_dashboard_refresh_event") as refresh_mock:
            response = self.client.post(
                reverse("device-list"),
                {
                    "line": str(self.line.id),
                    "name": "Camera Node 4",
                    "identifier": "camera-node-4",
                    "description": "Live dashboard create test",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        refresh_mock.assert_called_once_with("device.created")

    def test_device_update_emits_dashboard_refresh_event(self):
        self.client.force_authenticate(user=self.admin_user)

        with patch("apps.devices.views.schedule_dashboard_refresh_event") as refresh_mock:
            response = self.client.patch(
                reverse("device-detail", args=[self.device.id]),
                {
                    "latitude": 34.125,
                    "longitude": -6.831,
                    "map_label": "Updated camera location",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refresh_mock.assert_called_once_with("device.updated")

    def test_device_delete_emits_dashboard_refresh_event(self):
        self.client.force_authenticate(user=self.admin_user)

        with patch("apps.devices.views.schedule_dashboard_refresh_event") as refresh_mock:
            response = self.client.delete(reverse("device-detail", args=[self.device.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        refresh_mock.assert_called_once_with("device.deleted")

    def test_device_delete_with_related_inspections_fails_gracefully(self):
        Inspection.objects.create(
            device=self.device,
            inference_index=self.inference_index,
            organ_type=Inspection.OrganType.LEAF,
            status=Inspection.Status.NEW,
            processing_status=Inspection.ProcessingStatus.COMPLETED,
            source_message_id="device-protected-delete-test",
            top1_label="Healthy",
            confidence_score=0.87,
            captured_at=timezone.now(),
            received_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.admin_user)

        with patch("apps.devices.views.schedule_dashboard_refresh_event") as refresh_mock:
            response = self.client.delete(reverse("device-detail", args=[self.device.id]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["detail"],
            "This device cannot be deleted because it has recorded inspections.",
        )
        self.assertTrue(Device.objects.filter(pk=self.device.id).exists())
        refresh_mock.assert_not_called()

