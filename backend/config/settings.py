from datetime import timedelta
from pathlib import Path

from config.env import env, env_bool, env_int, env_list, load_env_file

BASE_DIR = Path(__file__).resolve().parent.parent
load_env_file(BASE_DIR / ".env")
AI_ASSETS_DIR = Path(env("AI_ASSETS_DIR", str(BASE_DIR.parent / "ai_assets"))).resolve()

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    "django-insecure-change-me-please-replace-this-secret",
)
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost,testserver")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "channels",
    "rest_framework",
    "apps.core.apps.CoreConfig",
    "apps.accounts.apps.AccountsConfig",
    "apps.devices.apps.DevicesConfig",
    "apps.catalog.apps.CatalogConfig",
    "apps.inference.apps.InferenceConfig",
    "apps.inspections.apps.InspectionsConfig",
    "apps.vectors.apps.VectorsConfig",
    "apps.review.apps.ReviewConfig",
    "apps.notifications.apps.NotificationsConfig",
    "apps.monitoring.apps.MonitoringConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.UpdateLastSeenMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "tomato_db"),
        "USER": env("POSTGRES_USER", "tomato_user"),
        "PASSWORD": env("POSTGRES_PASSWORD", "tomato_pass"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
    }
}
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = env("DJANGO_LANGUAGE_CODE", "en-us")
TIME_ZONE = env("DJANGO_TIME_ZONE", "UTC")

USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("DJANGO_MEDIA_URL", "/media/")
MEDIA_ROOT = Path(env("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media"))).resolve()

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.api.StandardResultsSetPagination",
    "PAGE_SIZE": env_int("API_PAGE_SIZE", 20),
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "rest_framework.schemas.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REDIS_URL = env("REDIS_URL", "redis://localhost:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    }
}

AI_WORKER_INGESTION_TOKEN = env(
    "AI_WORKER_INGESTION_TOKEN",
    "tomato-ai-worker-dev-token",
)
EVIDENCE_IMAGE_UPLOAD_TOKEN = env(
    "EVIDENCE_IMAGE_UPLOAD_TOKEN",
    "tomato-evidence-upload-dev-token",
)
EVIDENCE_IMAGE_UPLOAD_MAX_BYTES = env_int(
    "EVIDENCE_IMAGE_UPLOAD_MAX_BYTES",
    10 * 1024 * 1024,
)
EVIDENCE_IMAGE_COMMANDS_ENABLED = env_bool(
    "EVIDENCE_IMAGE_COMMANDS_ENABLED",
    False,
)
EVIDENCE_IMAGE_COMMAND_RABBITMQ_HOST = env(
    "EVIDENCE_IMAGE_COMMAND_RABBITMQ_HOST",
    "localhost",
)
EVIDENCE_IMAGE_COMMAND_RABBITMQ_PORT = env_int(
    "EVIDENCE_IMAGE_COMMAND_RABBITMQ_PORT",
    5672,
)
EVIDENCE_IMAGE_COMMAND_RABBITMQ_USERNAME = env(
    "EVIDENCE_IMAGE_COMMAND_RABBITMQ_USERNAME",
    "guest",
)
EVIDENCE_IMAGE_COMMAND_RABBITMQ_PASSWORD = env(
    "EVIDENCE_IMAGE_COMMAND_RABBITMQ_PASSWORD",
    "guest",
)
EVIDENCE_IMAGE_COMMAND_RABBITMQ_VHOST = env(
    "EVIDENCE_IMAGE_COMMAND_RABBITMQ_VHOST",
    "/",
)
EVIDENCE_IMAGE_COMMAND_EXCHANGE = env(
    "EVIDENCE_IMAGE_COMMAND_EXCHANGE",
    "amq.topic",
)
EVIDENCE_IMAGE_COMMAND_ROUTING_KEY_TEMPLATE = env(
    "EVIDENCE_IMAGE_COMMAND_ROUTING_KEY_TEMPLATE",
    "tomato.edge.v1.{device_identifier}.commands.image-request",
)
EVIDENCE_IMAGE_UPLOAD_BASE_URL = env(
    "EVIDENCE_IMAGE_UPLOAD_BASE_URL",
    "",
)

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", "")
EMAIL_PORT = env_int("EMAIL_PORT", 25)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "smart-eye@example.com")
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", "http://localhost:5173")
ALERT_EMAIL_RECIPIENTS = env_list("ALERT_EMAIL_RECIPIENTS", "")
REVIEW_EMAIL_RECIPIENTS = env_list("REVIEW_EMAIL_RECIPIENTS", "")
EMAIL_NOTIFICATIONS_ENABLED = env_bool("EMAIL_NOTIFICATIONS_ENABLED", False)
