from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.devices.models import Device, Greenhouse, Line, Site, Zone


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

