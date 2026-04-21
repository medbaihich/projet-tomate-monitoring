import axiosClient from '@/api/axiosClient';

export async function fetchDiseasesPage({ page, pageSize }) {
  const { data } = await axiosClient.get('/api/v1/catalog/diseases/', {
    params: {
      page: page + 1,
      page_size: pageSize,
    },
  });

  return data;
}

export async function createDisease(payload) {
  const { data } = await axiosClient.post('/api/v1/catalog/diseases/', payload);
  return data;
}
