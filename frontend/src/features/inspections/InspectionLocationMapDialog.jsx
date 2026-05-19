import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import DrawerCloseButton from '@/components/ui/DrawerCloseButton';
import { useThemeMode } from '@/theme-mode-context';
import {
  formatInspectionConfidence,
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDeviceRecord,
  resolveInspectionDiseaseLabel,
  resolveInspectionDiseaseRecord,
} from '@/features/inspections/utils';
import {
  deviceMarkerIcon,
  hasRenderableMapContainer,
  INSPECTION_DIALOG_MAP_ZOOM,
  isPresent,
  observeLeafletContainerSize,
  scheduleLeafletMapInvalidate,
  TILE_ATTRIBUTION,
  TILE_URL,
  toValidPosition,
} from '@/features/map/deviceMapUtils';

const ZONE_TYPE_LABELS = {
  infection_zone: 'Infection zone',
  vector_risk_zone: 'Vector risk zone',
  agronomic_risk_zone: 'Agronomic risk zone',
  risk_zone: 'Risk zone',
  none: 'No zone',
};
const FALLBACK_ZONE_COLORS = {
  infection_zone: '#dc2626',
  vector_risk_zone: '#7c3aed',
  agronomic_risk_zone: '#d97706',
  risk_zone: '#f59e0b',
  none: '#64748b',
};
const RISK_COLOR_FALLBACKS = {
  critical: '#b91c1c',
  high: '#dc2626',
  medium: '#f59e0b',
  low: '#16a34a',
};

function formatLabel(value) {
  if (!value) {
    return 'N/A';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  return isPresent(value) ? value : 'N/A';
}

function formatZoneType(value) {
  return ZONE_TYPE_LABELS[value] || formatLabel(value);
}

function formatRadius(value) {
  const radius = Number(value);

  if (!Number.isFinite(radius) || radius <= 0) {
    return '0 m';
  }

  return `${radius} m`;
}

function isValidCssColor(value) {
  if (!value || typeof value !== 'string' || typeof CSS === 'undefined' || !CSS.supports) {
    return false;
  }

  return CSS.supports('color', value);
}

function resolveSemanticColor(record) {
  if (isValidCssColor(record?.map_color)) {
    return record.map_color;
  }

  return (
    FALLBACK_ZONE_COLORS[record?.zone_type]
    || RISK_COLOR_FALLBACKS[record?.risk_level]
    || FALLBACK_ZONE_COLORS.risk_zone
  );
}

function getZoneStyle(profile) {
  const color = resolveSemanticColor(profile);

  return {
    color,
    fillColor: color,
    fillOpacity: profile?.zone_type === 'agronomic_risk_zone' ? 0.09 : 0.12,
    opacity: 0.9,
    weight: profile?.risk_level === 'critical' ? 3 : 2,
  };
}

function createInspectionPopupContent({
  inspection,
  deviceRecord,
  diseaseLabel,
  zoneProfile,
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2 text-sm';

  const title = document.createElement('div');
  title.className = 'font-semibold text-slate-950';
  title.textContent = diseaseLabel || 'Inspection location';
  wrapper.appendChild(title);

  const secondary = document.createElement('div');
  secondary.className = 'font-mono text-xs text-slate-600';
  secondary.textContent = inspection?.source_message_id || inspection?.id || 'Unknown inspection';
  wrapper.appendChild(secondary);

  const details = document.createElement('div');
  details.className = 'space-y-1 text-xs text-slate-700';
  [
    ['Confidence', formatInspectionConfidence(inspection?.confidence_score)],
    ['Captured', formatInspectionDateTime(inspection?.captured_at)],
    ['Device', deviceRecord?.name],
    ['Identifier', deviceRecord?.identifier],
    ['Site', deviceRecord?.site_name],
    ['Greenhouse', deviceRecord?.greenhouse_name],
    ['Zone', deviceRecord?.zone_name],
    ['Line', deviceRecord?.line_name],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.textContent = `${label}: ${value || 'N/A'}`;
    details.appendChild(row);
  });

  if (zoneProfile) {
    [
      ['Zone type', formatZoneType(zoneProfile.zone_type)],
      ['Spread radius', formatRadius(zoneProfile.spread_radius_m)],
      ['Risk level', formatLabel(zoneProfile.risk_level)],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.textContent = `${label}: ${value || 'N/A'}`;
      details.appendChild(row);
    });
  }

  wrapper.appendChild(details);

  if (zoneProfile?.short_map_description) {
    const description = document.createElement('p');
    description.className = 'max-w-xs text-xs leading-5 text-slate-600';
    description.textContent = zoneProfile.short_map_description;
    wrapper.appendChild(description);
  }

  return wrapper;
}

function shouldRenderZone(profile) {
  const radius = Number(profile?.spread_radius_m);

  return Boolean(
    profile
    && profile.is_active
    && profile.zone_type
    && profile.zone_type !== 'none'
    && Number.isFinite(radius)
    && radius > 0,
  );
}

export default function InspectionLocationMapDialog({
  open,
  inspection,
  deviceMap,
  diseaseMap,
  onClose,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const deviceRecord = useMemo(
    () => resolveInspectionDeviceRecord(inspection?.device, deviceMap),
    [deviceMap, inspection?.device],
  );
  const diseaseRecord = useMemo(
    () => resolveInspectionDiseaseRecord(inspection?.predicted_disease, diseaseMap),
    [diseaseMap, inspection?.predicted_disease],
  );
  const diseaseLabel = inspection
    ? (inspection.top1_label || resolveInspectionDiseaseLabel(inspection.predicted_disease, diseaseMap))
    : 'Selected inspection';
  const mapPosition = useMemo(
    () => toValidPosition(deviceRecord?.latitude, deviceRecord?.longitude),
    [deviceRecord?.latitude, deviceRecord?.longitude],
  );
  const hasLocalCoordinates = isPresent(deviceRecord?.local_x) || isPresent(deviceRecord?.local_y);
  const zoneProfile = diseaseRecord?.map_profile || null;
  const showZone = shouldRenderZone(zoneProfile) && Boolean(mapPosition);

  useEffect(() => {
    if (!open || !isDialogVisible || !mapContainerRef.current || !mapPosition) {
      return undefined;
    }

    const container = mapContainerRef.current;

    if (!hasRenderableMapContainer(container)) {
      return undefined;
    }

    const map = L.map(container, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(mapPosition, { icon: deviceMarkerIcon })
      .bindPopup(createInspectionPopupContent({
        inspection,
        deviceRecord,
        diseaseLabel,
        zoneProfile: showZone ? zoneProfile : null,
      }))
      .addTo(map);

    if (showZone) {
      L.circle(mapPosition, {
        ...getZoneStyle(zoneProfile),
        radius: Number(zoneProfile.spread_radius_m),
      })
        .bindPopup(createInspectionPopupContent({
          inspection,
          deviceRecord,
          diseaseLabel,
          zoneProfile,
        }))
        .addTo(map);
    }

    marker.openPopup();
    map.setView(mapPosition, INSPECTION_DIALOG_MAP_ZOOM);

    const stopContainerObserver = observeLeafletContainerSize(container, map);
    const stopScheduledInvalidate = scheduleLeafletMapInvalidate(map);

    return () => {
      stopContainerObserver();
      stopScheduledInvalidate();
      mapInstanceRef.current = null;
      map.remove();
    };
  }, [deviceRecord, diseaseLabel, inspection, isDialogVisible, mapPosition, open, showZone, zoneProfile]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        transition: {
          onEntered: () => setIsDialogVisible(true),
          onExit: () => setIsDialogVisible(false),
          onExited: () => setIsDialogVisible(false),
        },
      }}
      PaperProps={{
        sx: {
          overflow: 'hidden',
          backgroundImage: isLightMode
            ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(244,248,244,0.98))'
            : 'linear-gradient(180deg, rgba(9,16,14,0.99), rgba(5,10,9,0.98))',
          border: isLightMode ? '1px solid rgba(214,224,215,0.95)' : '1px solid rgba(148,163,184,0.16)',
          boxShadow: isLightMode ? '0 20px 44px rgba(15,23,42,0.14)' : '0 22px 54px rgba(0,0,0,0.34)',
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 1.5, sm: 1.75 },
          py: { xs: 1.15, sm: 1.35 },
          background: isLightMode
            ? 'linear-gradient(160deg, rgba(220,252,231,0.88), rgba(255,255,255,0.98))'
            : 'linear-gradient(160deg, rgba(21, 128, 61, 0.2), rgba(6, 15, 13, 0.98))',
          borderBottom: isLightMode ? '1px solid rgba(226, 232, 240, 0.92)' : '1px solid rgba(148, 163, 184, 0.16)',
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Stack spacing={0.45} sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: isLightMode ? '#166534' : '#86EFAC', lineHeight: 1.1, letterSpacing: 1.4 }}
              >
                Inspection map
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: isLightMode ? '#0f172a' : '#F8FAFC',
                  fontWeight: 850,
                  letterSpacing: '-0.03em',
                  overflowWrap: 'anywhere',
                }}
              >
                {diseaseLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
              >
                {inspection?.source_message_id || inspection?.id || 'Unknown inspection'}
              </Typography>
            </Stack>
            <DrawerCloseButton
              onClick={onClose}
              ariaLabel="Close inspection location map"
            />
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              icon={<PlaceRoundedIcon />}
              label={mapPosition ? 'Geographic coordinates available' : 'No geographic coordinates'}
              sx={isLightMode
                ? { borderColor: 'rgba(34,197,94,0.22)', bgcolor: 'rgba(220,252,231,0.78)', color: '#166534' }
                : { borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
              variant="outlined"
            />
            <Chip
              size="small"
              label={resolveInspectionDeviceLabel(inspection?.device, deviceMap)}
              sx={isLightMode
                ? { borderColor: 'rgba(203,213,225,0.95)', bgcolor: 'rgba(255,255,255,0.82)', color: '#475569' }
                : { borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
              variant="outlined"
            />
            {showZone ? (
              <Chip
                size="small"
                label={`${formatZoneType(zoneProfile.zone_type)} ${formatRadius(zoneProfile.spread_radius_m)}`}
                variant="outlined"
              />
            ) : null}
          </Stack>
        </Stack>
      </Box>

      <DialogContent sx={{ p: { xs: 1.25, sm: 1.5 }, bgcolor: isLightMode ? '#f1f6f2' : '#050A09' }}>
        {mapPosition ? (
          <Box
            sx={{
              overflow: 'hidden',
              borderRadius: 2,
              border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148,163,184,0.16)',
              bgcolor: isLightMode ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.03)',
              boxShadow: isLightMode ? '0 14px 30px rgba(15,23,42,0.06)' : 'none',
            }}
          >
            <Box
              ref={mapContainerRef}
              sx={{ height: 420, width: '100%' }}
              aria-label="Selected inspection location map"
            />
          </Box>
        ) : (
          <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{
              minHeight: 320,
              borderRadius: 2,
              border: isLightMode ? '1px dashed rgba(203,213,225,0.95)' : '1px dashed rgba(148,163,184,0.22)',
              bgcolor: isLightMode ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.03)',
              px: 3,
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148,163,184,0.22)',
                bgcolor: isLightMode ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
                color: isLightMode ? '#475569' : '#CBD5E1',
              }}
            >
              <MapOutlinedIcon />
            </Box>
            <Stack spacing={0.75} alignItems="center">
              <Typography variant="h6" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 800 }}>
                No geographic location available
              </Typography>
              <Typography variant="body2" sx={{ maxWidth: 480, color: isLightMode ? '#64748b' : 'rgba(203,213,225,0.78)' }}>
                This inspection cannot be placed on the geographic map because its linked device does not currently have a valid latitude and longitude.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
              <Chip size="small" label={resolveInspectionDeviceLabel(inspection?.device, deviceMap)} variant="outlined" />
              <Chip size="small" label={`Captured: ${formatInspectionDateTime(inspection?.captured_at)}`} variant="outlined" />
              <Chip size="small" label={`Confidence: ${formatInspectionConfidence(inspection?.confidence_score)}`} variant="outlined" />
              {hasLocalCoordinates ? (
                <Chip
                  size="small"
                  label={`Local layout: X ${formatValue(deviceRecord?.local_x)} / Y ${formatValue(deviceRecord?.local_y)}`}
                  variant="outlined"
                />
              ) : null}
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
