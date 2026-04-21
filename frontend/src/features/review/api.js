import axiosClient from '@/api/axiosClient';

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

export async function fetchReviewWorkspace() {
  const [inspections, reviews, devices, diseases] = await Promise.all([
    fetchAllPages('/api/v1/inspections/inspections/?page_size=100'),
    fetchAllPages('/api/v1/review/reviews/?page_size=100'),
    fetchAllPages('/api/v1/devices/devices/?page_size=100'),
    fetchAllPages('/api/v1/catalog/diseases/?page_size=100'),
  ]);

  return {
    inspections,
    reviews,
    devices,
    diseases,
  };
}

export async function submitReview(payload) {
  const { data } = await axiosClient.post('/api/v1/review/reviews/', payload);
  return data;
}
