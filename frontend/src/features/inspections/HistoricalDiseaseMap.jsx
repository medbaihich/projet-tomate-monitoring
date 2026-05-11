import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapPinned, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  buildInspectionMapSignalsQueryKey,
  fetchInspectionMapSignals,
} from '@/features/inspections/api';
import {
  formatInspectionConfidence,
  formatInspectionDateTime,
} from '@/features/inspections/utils';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const EMPTY_SUMMARY = {
  total_signals: 0,
  mapped_signals: 0,
  unmapped_signals: 0,
  infection_zone_count: 0,
};
const EMPTY_SIGNALS = [];
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
const deviceMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

function isPresent(value) {
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

function toValidPosition(latitudeValue, longitudeValue) {
  if (!isValidLatitude(latitudeValue) || !isValidLongitude(longitudeValue)) {
    return null;
  }

  return [Number(latitudeValue), Number(longitudeValue)];
}

function formatMapLabel(value) {
  if (!value) {
    return 'N/A';
  }

  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatZoneType(value) {
  return ZONE_TYPE_LABELS[value] || formatMapLabel(value);
}

function formatRadius(value) {
  const radius = Number(value);

  if (!Number.isFinite(radius) || radius < 0) {
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
    || RISK_COLOR_FALLBACKS[record?.severity]
    || FALLBACK_ZONE_COLORS.risk_zone
  );
}

function signalCreatesZone(signal) {
  const radius = Number(signal?.spread_radius_m);

  return (
    Number.isFinite(radius)
    && radius > 0
    && !signal?.profile_missing
    && !signal?.profile_inactive
    && signal?.zone_type
    && signal.zone_type !== 'none'
  );
}

function getZoneStyle(signal) {
  const color = resolveSemanticColor(signal);

  return {
    color,
    fillColor: color,
    fillOpacity: signal?.zone_type === 'agronomic_risk_zone' ? 0.09 : 0.12,
    opacity: 0.9,
    weight: signal?.risk_level === 'critical' ? 3 : 2,
  };
}

function appendPopupRow(container, label, value) {
  const row = document.createElement('div');
  row.textContent = `${label}: ${value || 'N/A'}`;
  container.appendChild(row);
}

function createSignalPopupContent(signal) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2 text-sm';

  const title = document.createElement('div');
  title.className = 'font-semibold text-slate-950';
  title.textContent = signal.disease_name || signal.label || 'Disease inspection';
  wrapper.appendChild(title);

  const details = document.createElement('div');
  details.className = 'space-y-1 text-xs text-slate-700';
  [
    ['Device', signal.device_name],
    ['Inspection', signal.inspection_id],
    ['Organ', formatMapLabel(signal.organ_type)],
    ['AI label', signal.ai_label],
    ['Confidence', formatInspectionConfidence(signal.confidence)],
    ['Captured', formatInspectionDateTime(signal.captured_at)],
    ['Zone type', formatZoneType(signal.zone_type)],
    ['Spread radius', formatRadius(signal.spread_radius_m)],
    ['Risk level', formatMapLabel(signal.risk_level || signal.severity)],
    ['Transmission', formatMapLabel(signal.transmission_mode)],
  ].forEach(([label, value]) => appendPopupRow(details, label, value));
  wrapper.appendChild(details);

  if (signal.short_map_description) {
    const description = document.createElement('p');
    description.className = 'max-w-xs text-xs leading-5 text-slate-600';
    description.textContent = signal.short_map_description;
    wrapper.appendChild(description);
  }

  return wrapper;
}

function fitMapToBounds(map, bounds, options) {
  if (!bounds?.isValid()) {
    return false;
  }

  try {
    map.fitBounds(bounds, options);
    return true;
  } catch {
    return false;
  }
}

function MapLoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full max-w-sm" />
      <Skeleton className="h-[26rem] w-full" />
    </div>
  );
}

export default function HistoricalDiseaseMap({
  filters = {},
  selectedInspectionId = '',
  onSignalSelect,
}) {
  const mapContainerRef = useRef(null);
  const mapSignalsQuery = useQuery({
    queryKey: buildInspectionMapSignalsQueryKey(filters),
    queryFn: () => fetchInspectionMapSignals(filters),
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const mapData = mapSignalsQuery.data;
  const summary = mapData?.summary ?? EMPTY_SUMMARY;
  const signals = mapData?.signals ?? EMPTY_SIGNALS;
  const mappedSignals = useMemo(
    () => signals.filter((signal) => toValidPosition(signal.latitude, signal.longitude)),
    [signals],
  );
  const zoneSignals = useMemo(
    () => mappedSignals.filter(signalCreatesZone),
    [mappedSignals],
  );
  const processingFilterBlocksMap = Boolean(
    filters.processing_status && filters.processing_status !== 'completed',
  );

  useEffect(() => {
    if (!mapContainerRef.current || mappedSignals.length === 0) {
      return undefined;
    }

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    const markerLayer = L.layerGroup().addTo(map);
    const zoneLayer = L.layerGroup().addTo(map);
    const bounds = L.latLngBounds([]);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    mappedSignals.forEach((signal) => {
      const position = toValidPosition(signal.latitude, signal.longitude);
      if (!position) {
        return;
      }

      bounds.extend(position);

      const marker = L.marker(position, { icon: deviceMarkerIcon })
        .bindPopup(createSignalPopupContent(signal))
        .addTo(markerLayer);

      if (onSignalSelect) {
        marker.on('click', () => onSignalSelect(signal));
      }

      if (signalCreatesZone(signal)) {
        L.circle(position, {
          ...getZoneStyle(signal),
          radius: Number(signal.spread_radius_m),
        })
          .bindPopup(createSignalPopupContent(signal))
          .addTo(zoneLayer)
          .on('click', () => onSignalSelect?.(signal));
      }

      if (selectedInspectionId && signal.inspection_id === selectedInspectionId) {
        marker.openPopup();
      }
    });

    const selectedSignal = mappedSignals.find((signal) => signal.inspection_id === selectedInspectionId);
    if (selectedSignal) {
      const selectedPosition = toValidPosition(selectedSignal.latitude, selectedSignal.longitude);
      if (selectedPosition) {
        map.setView(selectedPosition, 16);
      } else {
        fitMapToBounds(map, bounds, { padding: [28, 28], maxZoom: 16 });
      }
    } else {
      fitMapToBounds(map, bounds, { padding: [28, 28], maxZoom: 16 });
    }

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
    };
  }, [mappedSignals, onSignalSelect, selectedInspectionId]);

  if (mapSignalsQuery.isLoading) {
    return <MapLoadingState />;
  }

  if (mapSignalsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Historical disease map unavailable</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {mapSignalsQuery.error?.response?.data?.detail
              || mapSignalsQuery.error?.message
              || 'Failed to load historical disease map signals.'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => mapSignalsQuery.refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{summary.mapped_signals} mapped</Badge>
          <Badge variant="outline">{summary.unmapped_signals} unmapped</Badge>
          <Badge variant="outline">{zoneSignals.length} zones</Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={() => mapSignalsQuery.refetch()}
          disabled={mapSignalsQuery.isFetching}
        >
          <RefreshCw className={cn('h-4 w-4', mapSignalsQuery.isFetching && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {mappedSignals.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-slate-500 bg-slate-200" />
              Device marker
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-full border-2 border-red-600 bg-red-500/20" />
              Infection zone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-full border-2 border-violet-600 bg-violet-500/20" />
              Vector risk zone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-full border-2 border-amber-600 bg-amber-500/20" />
              Agronomic risk zone
            </span>
          </div>

          <div className="h-[26rem] overflow-hidden rounded-md border border-border bg-muted">
            <div ref={mapContainerRef} className="h-full w-full" aria-label="Historical disease map" />
          </div>
        </>
      ) : (
        <div className="flex h-[26rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
          <div className="mb-3 rounded-full border border-border bg-background p-3 text-muted-foreground">
            <MapPinned className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No mapped disease inspections yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {processingFilterBlocksMap
              ? 'The historical map only includes completed disease-positive inspections, so this processing filter produces no archived map signals.'
              : summary.total_signals === 0
              ? 'No disease-positive completed inspections are currently available for the historical map.'
              : 'Disease-positive inspections exist, but their devices do not have valid latitude and longitude yet.'}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Uses real device latitude and longitude from inspections map signals. No fake coordinates or live WebSocket layers are added here.
      </p>
    </div>
  );
}
