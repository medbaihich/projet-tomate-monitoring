import axiosClient from '@/api/axiosClient';

export async function fetchMyProfile() {
  const { data } = await axiosClient.get('/api/v1/auth/me/');
  return data;
}

export async function updateMyProfile(payload) {
  const { data } = await axiosClient.patch('/api/v1/auth/me/', payload);
  return data;
}

export async function changeMyPassword(payload) {
  const { data } = await axiosClient.post('/api/v1/auth/change-password/', payload);
  return data;
}
