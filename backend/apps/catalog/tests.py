from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.catalog.models import Disease


class CatalogRolePermissionTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="admin", description="Admin role")
        self.operator_role = Role.objects.create(name="operator", description="Operator role")
        self.admin_user = User.objects.create_user(
            username="catalog-admin",
            password="admin1234",
            role=self.admin_role,
        )
        self.operator_user = User.objects.create_user(
            username="catalog-operator",
            password="operator1234",
            role=self.operator_role,
        )
        self.disease = Disease.objects.create(
            name="Early Blight",
            slug="early-blight",
            summary="Common fungal disease.",
        )

    def test_operator_can_read_disease_list(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.get(reverse("disease-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_operator_cannot_create_disease(self):
        self.client.force_authenticate(user=self.operator_user)

        response = self.client.post(
            reverse("disease-list"),
            {
                "name": "Late Blight",
                "slug": "late-blight",
                "summary": "Fast-spreading disease.",
                "symptoms": "",
                "prevention": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_disease(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse("disease-list"),
            {
                "name": "Late Blight",
                "slug": "late-blight",
                "summary": "Fast-spreading disease.",
                "symptoms": "",
                "prevention": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Disease.objects.filter(slug="late-blight").exists())

