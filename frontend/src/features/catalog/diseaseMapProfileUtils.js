export const RISK_FALLBACK_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#16a34a',
};

export const ZONE_FALLBACK_COLORS = {
  infection_zone: '#dc2626',
  vector_risk_zone: '#7c3aed',
  agronomic_risk_zone: '#d97706',
  risk_zone: '#2563eb',
  none: '#64748b',
};

export function formatDiseaseMapLabel(value) {
  if (!value) {
    return 'N/A';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDiseaseMapRadius(value) {
  if (value === 0) {
    return '0 m';
  }

  return value ? `${value} m` : 'N/A';
}

export function isValidCssColor(value) {
  if (!value || typeof value !== 'string' || typeof CSS === 'undefined' || !CSS.supports) {
    return false;
  }

  return CSS.supports('color', value);
}

export function resolveDiseaseMapProfileColor(profile) {
  if (isValidCssColor(profile?.map_color)) {
    return profile.map_color;
  }

  return (
    ZONE_FALLBACK_COLORS[profile?.zone_type]
    || RISK_FALLBACK_COLORS[profile?.risk_level]
    || ZONE_FALLBACK_COLORS.none
  );
}

export function getDiseaseMapProfileRadiusValue(profile) {
  const radius = Number(profile?.spread_radius_m);
  return Number.isFinite(radius) && radius >= 0 ? radius : 0;
}

export function scaleDiseaseMapBubbleSize(radius, maxRadius) {
  if (radius <= 0 || maxRadius <= 0) {
    return 26;
  }

  const normalized = radius / maxRadius;
  return Math.round(26 + normalized * 54);
}

export function hasDiseaseMapConfiguredZone(profile) {
  const radius = getDiseaseMapProfileRadiusValue(profile);
  return Boolean(profile && profile.zone_type && profile.zone_type !== 'none' && radius > 0);
}
