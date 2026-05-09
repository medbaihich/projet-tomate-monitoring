import axiosClient from '@/api/axiosClient';

export const DEVICE_LINES_QUERY_KEY = ['device-lines'];
export const DEVICES_TABLE_QUERY_KEY = ['devices', 'table'];
export const DEVICES_FILTER_OPTIONS_QUERY_KEY = ['devices', 'filter-options'];

const DEVICE_ORDERING_FIELDS = {
  name: 'name',
  identifier: 'identifier',
  line_name: 'line__name',
  zone_name: 'line__zone__name',
  greenhouse_name: 'line__zone__greenhouse__name',
  site_name: 'line__zone__greenhouse__site__name',
  created_at: 'created_at',
  updated_at: 'updated_at',
};

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

export async function fetchLines() {
  return fetchAllPages('/api/v1/devices/lines/?page_size=100');
}

export async function fetchDevicesPage({
  pageIndex = 0,
  pageSize = 20,
  search = '',
  site = '',
  greenhouse = '',
  zone = '',
  line = '',
  sorting = [],
} = {}) {
  const params = new URLSearchParams({
    page: String(pageIndex + 1),
    page_size: String(pageSize),
  });
  const trimmedSearch = search.trim();
  const [sort] = sorting;
  const orderingField = sort ? DEVICE_ORDERING_FIELDS[sort.id] : '';

  if (trimmedSearch) {
    params.set('search', trimmedSearch);
  }

  if (site) {
    params.set('site', site);
  }

  if (greenhouse) {
    params.set('greenhouse', greenhouse);
  }

  if (zone) {
    params.set('zone', zone);
  }

  if (line) {
    params.set('line', line);
  }

  if (orderingField) {
    params.set('ordering', `${sort.desc ? '-' : ''}${orderingField}`);
  }

  const { data } = await axiosClient.get(`/api/v1/devices/devices/?${params.toString()}`);
  return data;
}

export async function fetchDevicesFilterOptions() {
  return fetchAllPages('/api/v1/devices/devices/?page_size=100&ordering=name');
}

export async function createLine(payload) {
  const { data } = await axiosClient.post('/api/v1/devices/lines/', payload);
  return data;
}

export async function createDevice(payload) {
  const { data } = await axiosClient.post('/api/v1/devices/devices/', payload);
  return data;
}
