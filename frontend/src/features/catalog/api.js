import axiosClient from '@/api/axiosClient';

export const CATALOG_DISEASES_QUERY_KEY = ['catalog-diseases'];
export const CATALOG_PROFILE_BOARD_QUERY_KEY = ['catalog-disease-profile-board'];
const CATALOG_ORDERING_FIELDS = {
  name: 'name',
  organ_type: 'organ_type',
  ai_label: 'ai_label',
  slug: 'slug',
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

export async function fetchDiseasesPage({
  page,
  pageSize,
  organType,
  sorting = [],
}) {
  const [sort] = sorting;
  const orderingField = sort ? CATALOG_ORDERING_FIELDS[sort.id] : '';

  const { data } = await axiosClient.get('/api/v1/catalog/diseases/', {
    params: {
      page: page + 1,
      page_size: pageSize,
      organ_type: organType || undefined,
      ordering: orderingField ? `${sort.desc ? '-' : ''}${orderingField}` : undefined,
    },
  });

  return data;
}

export async function fetchCatalogDiseaseProfileBoard() {
  return fetchAllPages('/api/v1/catalog/diseases/?page_size=100&ordering=organ_type,name');
}

export async function createDisease(payload) {
  const { data } = await axiosClient.post('/api/v1/catalog/diseases/', payload);
  return data;
}
