from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "created_at", "updated_at")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("username",)
    readonly_fields = ("created_at", "updated_at", "last_login", "date_joined")

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("RBAC", {"fields": ("role",)}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("RBAC", {"classes": ("wide",), "fields": ("role",)}),
    )
