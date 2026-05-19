import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
export const FOCUSED_DIALOG_MAP_ZOOM = 16;
export const INSPECTION_DIALOG_MAP_ZOOM = 18;

export const deviceMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

export function isPresent(value) {
  return value !== null && value !== undefined && value !== '';
}

function toCoordinate(value) {
  if (!isPresent(value)) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function isValidLatitude(value) {
  const latitude = toCoordinate(value);
  return latitude !== null && latitude >= -90 && latitude <= 90;
}

function isValidLongitude(value) {
  const longitude = toCoordinate(value);
  return longitude !== null && longitude >= -180 && longitude <= 180;
}

export function hasGeoCoordinates(device) {
  return toValidPosition(device?.latitude, device?.longitude) !== null;
}

export function hasRenderableMapContainer(element) {
  return Boolean(
    element
    && element.isConnected
    && element.clientWidth > 0
    && element.clientHeight > 0,
  );
}

export function toValidPosition(latitudeValue, longitudeValue) {
  if (!isValidLatitude(latitudeValue) || !isValidLongitude(longitudeValue)) {
    return null;
  }

  return [Number(latitudeValue), Number(longitudeValue)];
}

export function scheduleLeafletMapInvalidate(map) {
  let firstFrameId = 0;
  let secondFrameId = 0;
  let timeoutId = 0;

  const invalidate = () => {
    try {
      map.invalidateSize();
    } catch {
      // Ignore invalidation races during teardown.
    }
  };

  firstFrameId = window.requestAnimationFrame(() => {
    invalidate();
    secondFrameId = window.requestAnimationFrame(invalidate);
  });
  timeoutId = window.setTimeout(invalidate, 120);

  return () => {
    window.cancelAnimationFrame(firstFrameId);
    window.cancelAnimationFrame(secondFrameId);
    window.clearTimeout(timeoutId);
  };
}

export function observeLeafletContainerSize(container, map) {
  if (typeof ResizeObserver === 'undefined' || !container) {
    return () => {};
  }

  const observer = new ResizeObserver(() => {
    try {
      map.invalidateSize();
    } catch {
      // Ignore invalidation races during teardown.
    }
  });

  observer.observe(container);

  return () => {
    observer.disconnect();
  };
}

export function createDevicePopupContent(device) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2 text-sm';

  const title = document.createElement('div');
  title.className = 'font-semibold text-slate-950';
  title.textContent = device?.map_label || device?.name || 'Mapped device';
  wrapper.appendChild(title);

  const identifier = document.createElement('div');
  identifier.className = 'font-mono text-xs text-slate-600';
  identifier.textContent = device?.identifier || 'No identifier';
  wrapper.appendChild(identifier);

  const hierarchy = document.createElement('div');
  hierarchy.className = 'space-y-1 text-xs text-slate-700';
  [
    ['Site', device?.site_name],
    ['Greenhouse', device?.greenhouse_name],
    ['Zone', device?.zone_name],
    ['Line', device?.line_name],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.textContent = `${label}: ${value || 'N/A'}`;
    hierarchy.appendChild(row);
  });
  wrapper.appendChild(hierarchy);

  return wrapper;
}
