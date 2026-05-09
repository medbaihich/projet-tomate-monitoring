import axiosClient from '@/api/axiosClient';

export const MAP_DEVICES_QUERY_KEY = ['devices', 'map'];

async function fetchAllPages(initialUrl) {
  const items = [];
  let nextUrl = initialUrl;

  while (nextUrl) {
    const { data } = await axiosClient.get(nextUrl);

    items.push(...(data.results ?? []));
    nextUrl = data.next;
  }

  return items;
}

export async function fetchMapDevices() {
  return fetchAllPages('/api/v1/devices/devices/map/?page_size=100');
}
