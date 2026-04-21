from django.urls import path

from apps.monitoring.views import (
    MonitoringSummaryView,
    NotificationActivityListView,
    NotificationReadActivityListView,
    NotificationReadersListView,
    UserActivityListView,
)


urlpatterns = [
    path("summary/", MonitoringSummaryView.as_view(), name="monitoring-summary"),
    path("notifications/activity/", NotificationActivityListView.as_view(), name="monitoring-notification-activity"),
    path("notifications/read-activity/", NotificationReadActivityListView.as_view(), name="monitoring-notification-read-activity"),
    path("notifications/<uuid:pk>/readers/", NotificationReadersListView.as_view(), name="monitoring-notification-readers"),
    path("users/activity/", UserActivityListView.as_view(), name="monitoring-user-activity"),
]
