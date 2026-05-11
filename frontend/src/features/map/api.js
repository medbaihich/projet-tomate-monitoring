import axiosClient from '@/api/axiosClient';

export const MAP_DEVICES_QUERY_KEY = ['devices', 'map'];
export const DASHBOARD_DISEASE_MAP_SIGNALS_QUERY_KEY = ['dashboard', 'map', 'disease-signals'];
const DISEASE_MAP_SIGNAL_PARAM_NAMES = [
  'disease',
  'disease_name',
  'severity',
  'min_confidence',
  'captured_after',
  'captured_before',
  'site',
  'greenhouse',
  'zone',
  'line',
  'organ_type',
];

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

export function buildDiseaseMapSignalParams(params = {}) {
  return DISEASE_MAP_SIGNAL_PARAM_NAMES.reduce((activeParams, paramName) => {
    const value = params[paramName];

    if (value !== null && value !== undefined && value !== '') {
      activeParams[paramName] = value;
    }

    return activeParams;
  }, {});
}

export function buildDashboardDiseaseMapSignalsQueryKey(params = {}) {
  return [
    ...DASHBOARD_DISEASE_MAP_SIGNALS_QUERY_KEY,
    buildDiseaseMapSignalParams(params),
  ];
}

export async function fetchDashboardDiseaseMapSignals(params = {}) {
  const { data } = await axiosClient.get('/api/v1/inspections/map-signals/', {
    params: buildDiseaseMapSignalParams(params),
  });

  return data;
}
