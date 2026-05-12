from __future__ import annotations

import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasValidAIWorkerIngestionToken(BasePermission):
    message = "Invalid AI worker ingestion token."

    def has_permission(self, request, view):
        configured_token = getattr(settings, "AI_WORKER_INGESTION_TOKEN", "")
        if not configured_token:
            return False

        authorization_header = request.headers.get("Authorization", "")
        scheme, _, token = authorization_header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return False

        return secrets.compare_digest(token, configured_token)
