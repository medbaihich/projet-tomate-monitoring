export function formatInspectionDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
}

export function formatInspectionConfidence(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return 'Invalid';
  }

  return `${Math.round(value * 100)}%`;
}

export function resolveInspectionDeviceLabel(deviceId, deviceMap) {
  if (!deviceId) {
    return 'Unknown device';
  }

  const device = deviceMap.get(deviceId);
  if (!device) {
    return 'Unknown device';
  }

  return `${device.name} (${device.identifier})`;
}

export function resolveInspectionDiseaseLabel(diseaseId, diseaseMap, fallback = 'Unknown prediction') {
  if (!diseaseId) {
    return fallback;
  }

  return diseaseMap.get(diseaseId)?.name || fallback;
}

export function buildMetadataRows(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: value === null || value === undefined
      ? 'N/A'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value),
  }));
}
