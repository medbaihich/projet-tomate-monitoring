from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User


class AccountSelfManagementTests(APITestCase):
    def setUp(self):
        self.operator_role = Role.objects.create(name="operator", description="Operator role")
        self.admin_role = Role.objects.create(name="admin", description="Admin role")
        self.user = User.objects.create_user(
            username="operator-user",
            password="operator1234",
            email="operator@example.com",
            first_name="Operator",
            last_name="User",
            role=self.operator_role,
        )
        self.other_user = User.objects.create_user(
            username="second-user",
            password="second1234",
            email="second@example.com",
            first_name="Second",
            last_name="User",
            role=self.admin_role,
        )
        self.client.force_authenticate(user=self.user)

    def test_me_endpoint_returns_current_user_with_read_only_role(self):
        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(str(response.data["id"]), str(self.user.id))
        self.assertEqual(response.data["username"], self.user.username)
        self.assertEqual(
            response.data["role"],
            {
                "id": str(self.operator_role.id),
                "name": self.operator_role.name,
            },
        )

    def test_me_patch_updates_only_current_user_profile_fields(self):
        response = self.client.patch(
            reverse("auth-me"),
            {
                "email": "updated@example.com",
                "first_name": "Updated",
                "last_name": "Name",
                "role": str(self.admin_role.id),
                "username": "changed-username",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.other_user.refresh_from_db()

        self.assertEqual(self.user.email, "updated@example.com")
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.last_name, "Name")
        self.assertEqual(self.user.username, "operator-user")
        self.assertEqual(self.user.role_id, self.operator_role.id)
        self.assertEqual(self.other_user.email, "second@example.com")

    def test_change_password_updates_current_user_password(self):
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "operator1234",
                "new_password": "new-safe-pass-123",
                "confirm_new_password": "new-safe-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Password updated successfully.")

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-safe-pass-123"))
        self.assertFalse(self.user.check_password("operator1234"))

    def test_change_password_rejects_incorrect_current_password(self):
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "wrong-password",
                "new_password": "new-safe-pass-123",
                "confirm_new_password": "new-safe-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            {"current_password": ["Current password is incorrect."]},
        )

    def test_change_password_rejects_mismatched_confirmation(self):
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "operator1234",
                "new_password": "new-safe-pass-123",
                "confirm_new_password": "different-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            {"confirm_new_password": ["New password and confirmation do not match."]},
        )

    def test_change_password_applies_django_password_validation(self):
        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "operator1234",
                "new_password": "12345678",
                "confirm_new_password": "12345678",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

