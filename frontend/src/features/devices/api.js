import axiosClient from '@/api/axiosClient';

export const DEVICES_HIERARCHY_QUERY_KEY = ['devices-hierarchy'];

export async function fetchDevicesHierarchy() {
  const sites = [];
  let nextUrl = '/api/v1/devices/sites/?page_size=100';

  while (nextUrl) {
    const { data } = await axiosClient.get(nextUrl);

    sites.push(...(data.results ?? []));
    nextUrl = data.next;
  }

  return sites;
}

export async function createDevice(payload) {
  const { data } = await axiosClient.post('/api/v1/devices/devices/', payload);
  return data;
}
