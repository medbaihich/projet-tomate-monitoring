import axiosClient from '@/api/axiosClient';

export const INSPECTIONS_WORKSPACE_QUERY_KEY = ['inspections-workspace'];
export const INSPECTION_REFERENCE_DATA_QUERY_KEY = ['inspection-reference-data'];
export const INSPECTION_MAP_SIGNALS_QUERY_KEY = ['inspections', 'map-signals'];
const INSPECTION_ORDERING_FIELDS = {
  captured_at: 'captured_at',
  confidence_score: 'confidence_score',
  processed_or_updated: 'processed_at',
};
const INSPECTION_MAP_SIGNAL_PARAM_NAMES = [
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
  'device',
  'status',
  'processing_status',
];
const INSPECTION_LIST_FILTER_PARAM_NAMES = [
  'search',
  'device',
  'predicted_disease',
  'organ_type',
  'status',
  'processing_status',
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

export async function fetchInspectionReferenceData() {
  const [devices, diseases] = await Promise.all([
    fetchAllPages('/api/v1/devices/devices/?page_size=100'),
    fetchAllPages('/api/v1/catalog/diseases/?page_size=100'),
  ]);

  return {
    devices,
    diseases,
  };
}

export async function fetchInspectionsPage({
  pageIndex = 0,
  pageSize = 20,
  sorting = [],
  filters = {},
} = {}) {
  const [sort] = sorting;
  const orderingField = sort ? INSPECTION_ORDERING_FIELDS[sort.id] : '';

  const { data } = await axiosClient.get('/api/v1/inspections/inspections/', {
    params: {
      page: pageIndex + 1,
      page_size: pageSize,
      ordering: orderingField ? `${sort.desc ? '-' : ''}${orderingField}` : '-captured_at',
      ...buildInspectionListParams(filters),
    },
  });

  return data;
}

export function buildInspectionListParams(filters = {}) {
  return INSPECTION_LIST_FILTER_PARAM_NAMES.reduce((activeParams, paramName) => {
    const value = filters[paramName];

    if (value !== null && value !== undefined && value !== '') {
      activeParams[paramName] = value;
    }

    return activeParams;
  }, {});
}

export function buildInspectionMapSignalParams(params = {}) {
  return INSPECTION_MAP_SIGNAL_PARAM_NAMES.reduce((activeParams, paramName) => {
    const value = params[paramName];

    if (value !== null && value !== undefined && value !== '') {
      activeParams[paramName] = value;
    }

    return activeParams;
  }, {});
}

export function buildInspectionMapSignalsQueryKey(params = {}) {
  return [
    ...INSPECTION_MAP_SIGNALS_QUERY_KEY,
    buildInspectionMapSignalParams(params),
  ];
}

export async function fetchInspectionMapSignals(params = {}) {
  const { data } = await axiosClient.get('/api/v1/inspections/map-signals/', {
    params: buildInspectionMapSignalParams(params),
  });

  return data;
}

export async function fetchInspectionById(inspectionId) {
  const { data } = await axiosClient.get(`/api/v1/inspections/inspections/${inspectionId}/`);
  return data;
}
