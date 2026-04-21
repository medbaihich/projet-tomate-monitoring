from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import User


class UserRoleMixin(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    def get_role(self, obj):
        if obj.role is None:
            return None

        return {
            "id": str(obj.role_id),
            "name": obj.role.name,
        }


class CurrentUserSerializer(UserRoleMixin):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
        )
        read_only_fields = fields


class CurrentUserUpdateSerializer(UserRoleMixin):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
        )
        read_only_fields = ("id", "username", "role")


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    default_error_messages = {
        "current_password_incorrect": "Current password is incorrect.",
        "new_password_mismatch": "New password and confirmation do not match.",
    }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self.context["request"].user

        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError(
                {"current_password": self.error_messages["current_password_incorrect"]}
            )

        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError(
                {"confirm_new_password": self.error_messages["new_password_mismatch"]}
            )

        validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
