import axiosClient from '@/api/axiosClient';

export const INSPECTIONS_WORKSPACE_QUERY_KEY = ['inspections-workspace'];
export const INSPECTION_REFERENCE_DATA_QUERY_KEY = ['inspection-reference-data'];

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
  page = 0,
  pageSize = 20,
  ordering = '-captured_at',
} = {}) {
  const { data } = await axiosClient.get('/api/v1/inspections/inspections/', {
    params: {
      page: page + 1,
      page_size: pageSize,
      ordering,
    },
  });

  return data;
}
