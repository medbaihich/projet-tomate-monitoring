from django.urls import path

from apps.accounts.views import (
    ChangePasswordView,
    CurrentUserView,
    LoginView,
    RefreshTokenView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshTokenView.as_view(), name="auth-refresh"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]
