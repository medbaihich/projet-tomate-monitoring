from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.devices.models import Device, Greenhouse, Site, Zone


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
        self.device = Device.objects.create(
            zone=self.zone,
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
                "zone": str(self.zone.id),
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
                "zone": str(self.zone.id),
                "name": "Camera Node 2",
                "identifier": "camera-node-2",
                "description": "New camera",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Device.objects.filter(identifier="camera-node-2").exists())

