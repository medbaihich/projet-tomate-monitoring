import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.conf import settings
from django.contrib.staticfiles.handlers import ASGIStaticFilesHandler
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_application = get_asgi_application()
http_application = (
    ASGIStaticFilesHandler(django_asgi_application)
    if settings.DEBUG
    else django_asgi_application
)

from apps.notifications.auth import JWTAuthMiddlewareStack
from apps.notifications.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": http_application,
        "websocket": JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        ),
    }
)
