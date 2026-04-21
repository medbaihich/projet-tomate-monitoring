from rest_framework.permissions import SAFE_METHODS, BasePermission


class RolePermissionMixin:
    allowed_roles = ()
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if user is None or not user.is_authenticated:
            return False

        role_name = getattr(getattr(user, "role", None), "name", "")
        return role_name.strip().lower() in self.allowed_roles


class IsAdminRole(RolePermissionMixin, BasePermission):
    allowed_roles = ("admin",)
    message = "Administrator access is required."


class IsAuthenticatedReadOnlyOrAdminWrite(BasePermission):
    message = "Administrator access is required for write operations."

    def has_permission(self, request, view):
        user = request.user
        if user is None or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        role_name = getattr(getattr(user, "role", None), "name", "")
        return role_name.strip().lower() == "admin"
