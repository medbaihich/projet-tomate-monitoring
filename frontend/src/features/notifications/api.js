import axiosClient from '@/api/axiosClient';

export const NOTIFICATIONS_PAGE_SIZE = 12;

export async function fetchNotificationsPage({ pageSize = NOTIFICATIONS_PAGE_SIZE, isRead } = {}) {
  const params = { page_size: pageSize };

  if (isRead !== undefined) {
    params.is_read = isRead;
  }

  const { data } = await axiosClient.get('/api/v1/notifications/', { params });
  return data;
}

export async function fetchUnreadNotificationsCount() {
  const data = await fetchNotificationsPage({ pageSize: 1, isRead: false });
  return data.count ?? 0;
}

export async function markNotificationRead(notificationId) {
  const { data } = await axiosClient.post(`/api/v1/notifications/${notificationId}/mark-read/`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await axiosClient.post('/api/v1/notifications/mark-all-read/');
  return data;
}
