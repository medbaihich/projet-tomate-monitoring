from rest_framework import status
from rest_framework.generics import GenericAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    CurrentUserUpdateSerializer,
)


class LoginView(TokenObtainPairView):
    authentication_classes = []
    permission_classes = [AllowAny]


class RefreshTokenView(TokenRefreshView):
    authentication_classes = []
    permission_classes = [AllowAny]


class CurrentUserView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method.lower() == "patch":
            return CurrentUserUpdateSerializer
        return CurrentUserSerializer


class ChangePasswordView(GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "head", "options"]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )
