from rest_framework import serializers

from apps.accounts.models import User


class CurrentUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

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

    def get_role(self, obj):
        if obj.role is None:
            return None

        return {
            "id": str(obj.role_id),
            "name": obj.role.name,
        }
