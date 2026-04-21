from django.urls import path

from apps.notifications.views import NotificationViewSet


notification_list = NotificationViewSet.as_view({"get": "list"})
notification_detail = NotificationViewSet.as_view({"get": "retrieve"})
notification_mark_read = NotificationViewSet.as_view({"post": "mark_read"})
notification_mark_all_read = NotificationViewSet.as_view({"post": "mark_all_read"})

urlpatterns = [
    path("", notification_list, name="notification-list"),
    path("mark-all-read/", notification_mark_all_read, name="notification-mark-all-read"),
    path("<uuid:pk>/", notification_detail, name="notification-detail"),
    path("<uuid:pk>/mark-read/", notification_mark_read, name="notification-mark-read"),
]
