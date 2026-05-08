import axiosClient from '@/api/axiosClient';

export const DEVICES_HIERARCHY_QUERY_KEY = ['devices-hierarchy', 'with-lines'];
export const DEVICE_LINES_QUERY_KEY = ['device-lines'];

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

function normalizeDevice(device, line, zone, greenhouse, site) {
  return {
    ...device,
    line: device.line ?? line.id,
    line_name: device.line_name ?? line.name,
    zone: device.zone ?? zone.id,
    zone_name: device.zone_name ?? zone.name,
    greenhouse: device.greenhouse ?? greenhouse.id,
    greenhouse_name: device.greenhouse_name ?? greenhouse.name,
    site: device.site ?? site.id,
    site_name: device.site_name ?? site.name,
  };
}

function normalizeHierarchy(sites) {
  return sites.map((site) => ({
    ...site,
    greenhouses: (site.greenhouses ?? []).map((greenhouse) => ({
      ...greenhouse,
      zones: (greenhouse.zones ?? []).map((zone) => ({
        ...zone,
        lines: (zone.lines ?? []).map((line) => ({
          ...line,
          devices: (line.devices ?? []).map((device) =>
            normalizeDevice(device, line, zone, greenhouse, site),
          ),
        })),
      })),
    })),
  }));
}

export async function fetchDevicesHierarchy() {
  return normalizeHierarchy(await fetchAllPages('/api/v1/devices/sites/?page_size=100'));
}

export async function fetchLines() {
  return fetchAllPages('/api/v1/devices/lines/?page_size=100');
}

export async function createLine(payload) {
  const { data } = await axiosClient.post('/api/v1/devices/lines/', payload);
  return data;
}

export async function createDevice(payload) {
  const { data } = await axiosClient.post('/api/v1/devices/devices/', payload);
  return data;
}
