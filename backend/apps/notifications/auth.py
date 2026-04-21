from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        user = scope.get("user")

        if user is None or not user.is_authenticated:
            raw_token = self._get_token_from_scope(scope)
            scope["user"] = await self._get_user(raw_token)

        return await super().__call__(scope, receive, send)

    def _get_token_from_scope(self, scope):
        query_string = parse_qs(scope.get("query_string", b"").decode("utf-8"))
        token_values = query_string.get("token", [])
        if token_values:
            return token_values[0]

        for key, value in scope.get("headers", []):
            if key == b"authorization":
                header_value = value.decode("utf-8")
                if header_value.lower().startswith("bearer "):
                    return header_value.split(" ", 1)[1]

        return None

    @database_sync_to_async
    def _get_user(self, raw_token):
        from django.contrib.auth.models import AnonymousUser
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        if not raw_token:
            return AnonymousUser()

        jwt_authentication = JWTAuthentication()

        try:
            validated_token = jwt_authentication.get_validated_token(raw_token)
            return jwt_authentication.get_user(validated_token)
        except (InvalidToken, TokenError, AuthenticationFailed):
            return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    return AuthMiddlewareStack(JWTAuthMiddleware(inner))
