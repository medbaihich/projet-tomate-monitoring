from datetime import timedelta

from django.utils import timezone


LAST_SEEN_UPDATE_INTERVAL = timedelta(minutes=1)


class UpdateLastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        self._update_last_seen(request)
        return response

    def _update_last_seen(self, request):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return

        now = timezone.now()
        last_seen_at = getattr(user, "last_seen_at", None)
        if last_seen_at is not None and now - last_seen_at < LAST_SEEN_UPDATE_INTERVAL:
            return

        user.__class__.objects.filter(pk=user.pk).update(last_seen_at=now)
        user.last_seen_at = now
