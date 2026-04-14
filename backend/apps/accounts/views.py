from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.serializers import CurrentUserSerializer


class LoginView(TokenObtainPairView):
    authentication_classes = []
    permission_classes = [AllowAny]


class RefreshTokenView(TokenRefreshView):
    authentication_classes = []
    permission_classes = [AllowAny]


class CurrentUserView(RetrieveAPIView):
    serializer_class = CurrentUserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
