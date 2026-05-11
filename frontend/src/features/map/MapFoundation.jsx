import { useEffect, useMemo, useRef, useState } from 'react';
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
  buildDashboardDiseaseMapSignalsQueryKey,
  fetchDashboardDiseaseMapSignals,
  fetchMapDevices,
  MAP_DEVICES_QUERY_KEY,
} from '@/features/map/api';

const FILTER_SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const EMPTY_DEVICES = [];
const EMPTY_DISEASE_MAP_SUMMARY = {
  total_signals: 0,
  mapped_signals: 0,
  unmapped_signals: 0,
  infection_zone_count: 0,
};
const EMPTY_DISEASE_SIGNALS = [];
const EMPTY_INFECTION_ZONES = [];
const EMPTY_DISEASE_MAP_FILTERS = {};
const EMPTY_DISEASE_OPTIONS = [];
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
const CONFIDENCE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: '0.5', label: '>= 50%' },
  { value: '0.7', label: '>= 70%' },
  { value: '0.85', label: '>= 85%' },
];
const TIME_WINDOW_OPTIONS = [
  { value: '24h', label: 'Last 24h', hours: 24 },
  { value: '7d', label: 'Last 7d', hours: 24 * 7 },
  { value: '30d', label: 'Last 30d', hours: 24 * 30 },
  { value: '', label: 'All', hours: null },
];
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

function hasGeoCoordinates(device) {
  const latitude = toCoordinate(device.latitude);
  const longitude = toCoordinate(device.longitude);

  return (
    latitude !== null
    && longitude !== null
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  );
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

function addOption(options, id, label) {
  if (!id || options.has(id)) {
    return;
  }

  options.set(id, {
    id,
    label: label || 'N/A',
  });
}

function sortOptions(options) {
  return [...options].sort((first, second) => first.label.localeCompare(second.label));
}

function buildHierarchyOptions(devices) {
  const sites = new Map();
  const greenhouses = new Map();
  const zones = new Map();
  const lines = new Map();

  for (const device of devices) {
    addOption(sites, device.site, device.site_name);
    addOption(greenhouses, device.greenhouse, device.greenhouse_name);
    addOption(zones, device.zone, device.zone_name);
    addOption(lines, device.line, device.line_name);
  }

  return {
    siteOptions: sortOptions(sites.values()),
    greenhouseOptions: sortOptions(greenhouses.values()),
    zoneOptions: sortOptions(zones.values()),
    lineOptions: sortOptions(lines.values()),
  };
}

function createPopupContent(device) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2 text-sm';

  const title = document.createElement('div');
  title.className = 'font-semibold text-slate-950';
  title.textContent = device.map_label || device.name || 'Mapped device';
  wrapper.appendChild(title);

  const identifier = document.createElement('div');
  identifier.className = 'font-mono text-xs text-slate-600';
  identifier.textContent = device.identifier || 'No identifier';
  wrapper.appendChild(identifier);

  const hierarchy = document.createElement('div');
  hierarchy.className = 'space-y-1 text-xs text-slate-700';
  [
    ['Site', device.site_name],
    ['Greenhouse', device.greenhouse_name],
    ['Zone', device.zone_name],
    ['Line', device.line_name],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.textContent = `${label}: ${value || 'N/A'}`;
    hierarchy.appendChild(row);
  });
  wrapper.appendChild(hierarchy);

  return wrapper;
}

function formatConfidence(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
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

function formatBooleanFlag(value, trueLabel, falseLabel) {
  if (value === true) {
    return trueLabel;
  }

  if (value === false) {
    return falseLabel;
  }

  return 'N/A';
}

function formatRadiusMeters(value) {
  const radius = Number(value);
  if (!Number.isFinite(radius)) {
    return 'N/A';
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

function appendPopupRow(container, label, value) {
  const row = document.createElement('div');
  row.textContent = `${label}: ${value || 'N/A'}`;
  container.appendChild(row);
}

function createDiseaseSignalPopupContent(signal) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2 text-sm';

  const title = document.createElement('div');
  title.className = 'font-semibold text-slate-950';
  title.textContent = signal.disease_name || signal.label || 'Disease signal';
  wrapper.appendChild(title);

  const details = document.createElement('div');
  details.className = 'space-y-1 text-xs text-slate-700';
  [
    ['Inspection', signal.inspection_id],
    ['Source message', signal.source_message_id],
    ['Device', signal.device_name],
    ['Identifier', signal.identifier],
    ['Disease', signal.disease_name || signal.label],
    ['Confidence', formatConfidence(signal.confidence)],
    ['Organ', formatMapLabel(signal.organ_type)],
    ['AI label', signal.ai_label],
    ['Infectious', formatBooleanFlag(signal.is_infectious, 'Infectious', 'Non-infectious')],
    ['Zone type', formatZoneType(signal.zone_type)],
    ['Risk level', formatMapLabel(signal.risk_level || signal.severity)],
    ['Transmission', formatMapLabel(signal.transmission_mode)],
    ['Spread radius', formatRadiusMeters(signal.spread_radius_m)],
    ['Profile', signal.profile_missing ? 'Missing' : signal.profile_inactive ? 'Inactive' : 'Active'],
    ['Captured', formatDateTime(signal.captured_at)],
    ['Site', signal.site_name],
    ['Greenhouse', signal.greenhouse_name],
    ['Zone', signal.zone_name],
    ['Line', signal.line_name],
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

function createInfectionZonePopupContent(zone) {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2 text-sm';

  const title = document.createElement('div');
  title.className = 'font-semibold text-slate-950';
  title.textContent = `${formatZoneType(zone.zone_type)}: ${zone.disease_name || 'Disease'}`;
  wrapper.appendChild(title);

  const details = document.createElement('div');
  details.className = 'space-y-1 text-xs text-slate-700';
  [
    ['Organ', formatMapLabel(zone.organ_type)],
    ['AI label', zone.ai_label],
    ['Infectious', formatBooleanFlag(zone.is_infectious, 'Infectious', 'Non-infectious')],
    ['Zone type', formatZoneType(zone.zone_type)],
    ['Risk level', formatMapLabel(zone.risk_level || zone.severity)],
    ['Spread category', formatMapLabel(zone.spread_category)],
    ['Transmission', formatMapLabel(zone.transmission_mode)],
    ['Profile', zone.profile_missing ? 'Missing' : zone.profile_inactive ? 'Inactive' : 'Active'],
    ['Signal count', zone.signal_count],
    ['Max confidence', formatConfidence(zone.max_confidence)],
    ['Latest captured', formatDateTime(zone.latest_captured_at)],
    ['Configured radius', formatRadiusMeters(zone.spread_radius_m || zone.radius_meters)],
    ['Site', zone.site_name],
    ['Greenhouse', zone.greenhouse_name],
    ['Zone', zone.zone_name],
    ['Line', zone.line_name],
  ].forEach(([label, value]) => appendPopupRow(details, label, value));
  wrapper.appendChild(details);

  if (zone.short_map_description) {
    const description = document.createElement('p');
    description.className = 'max-w-xs text-xs leading-5 text-slate-600';
    description.textContent = zone.short_map_description;
    wrapper.appendChild(description);
  }

  const reason = document.createElement('p');
  reason.className = 'max-w-xs text-xs leading-5 text-slate-600';
  reason.textContent = zone.radius_reason || 'Approximate risk zone for operational visualization.';
  wrapper.appendChild(reason);

  return wrapper;
}

function getSemanticZoneStyle(zone) {
  const color = resolveSemanticColor(zone);

  return {
    color,
    fillColor: color,
    fillOpacity: zone?.zone_type === 'agronomic_risk_zone' ? 0.09 : 0.12,
    opacity: 0.9,
    weight: zone?.risk_level === 'critical' ? 3 : 2,
  };
}

function getSemanticSignalStyle(signal, diseaseFiltersActive) {
  const color = resolveSemanticColor(signal);

  return {
    color,
    fillColor: color,
    radius: diseaseFiltersActive ? 8 : 6,
    fillOpacity: 0.92,
    opacity: 1,
    weight: diseaseFiltersActive ? 3 : 2,
  };
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

function buildCapturedAfterForWindow(timeWindow) {
  const option = TIME_WINDOW_OPTIONS.find((item) => item.value === timeWindow);
  if (!option?.hours) {
    return '';
  }

  return new Date(Date.now() - option.hours * 60 * 60 * 1000).toISOString();
}

function buildDiseaseFilterParam(value) {
  if (!value) {
    return {};
  }

  if (value.startsWith('key:')) {
    return {
      disease_name: value.slice(4),
    };
  }

  if (value.startsWith('id:')) {
    return {
      disease: value.slice(3),
    };
  }

  return {
    disease: value,
  };
}

function toDiseaseFilterValue(disease) {
  if (disease.id) {
    return `id:${disease.id}`;
  }

  return `key:${disease.key}`;
}

function DiseaseFilterControl({ label, value, onChange, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FILTER_SELECT_CLASS}
      >
        {children}
      </select>
    </label>
  );
}

function DiseaseMapLayerStatus({ query, summary }) {
  if (query.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Disease map data unavailable</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {query.error?.response?.data?.detail
              || query.error?.message
              || 'Failed to load dashboard disease map signals.'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => query.refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.total_signals === 0) {
    return (
      <Alert>
        <AlertTitle>No disease signals</AlertTitle>
        <AlertDescription>
          No disease signals match the current filters.
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.mapped_signals === 0) {
    return (
      <Alert>
        <AlertTitle>No mapped disease signals</AlertTitle>
        <AlertDescription>
          Disease-positive inspections were found, but their devices do not have valid latitude and longitude.
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.infection_zone_count === 0) {
    return (
      <Alert>
        <AlertTitle>No map zones</AlertTitle>
        <AlertDescription>
          Mapped disease signals are available, but none currently qualify for an estimated risk zone.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      Dashboard disease map data is ready for signal markers and estimated risk zone circles.
    </div>
  );
}

function DiseaseMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-red-900 bg-red-500" />
        Disease signal marker
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
  );
}

export default function MapFoundation({
  enableDiseaseLayers = false,
  diseaseMapFilters = EMPTY_DISEASE_MAP_FILTERS,
  showFilters = true,
  selectedDeviceId = '',
  onDeviceSelect,
  siteFilter: controlledSiteFilter,
  greenhouseFilter: controlledGreenhouseFilter,
  zoneFilter: controlledZoneFilter,
  lineFilter: controlledLineFilter,
  siteOptions: controlledSiteOptions,
  greenhouseOptions: controlledGreenhouseOptions,
  zoneOptions: controlledZoneOptions,
  lineOptions: controlledLineOptions,
  onSiteFilterChange,
  onGreenhouseFilterChange,
  onZoneFilterChange,
  onLineFilterChange,
}) {
  const mapContainerRef = useRef(null);
  const [internalSiteFilter, setInternalSiteFilter] = useState('');
  const [internalGreenhouseFilter, setInternalGreenhouseFilter] = useState('');
  const [internalZoneFilter, setInternalZoneFilter] = useState('');
  const [internalLineFilter, setInternalLineFilter] = useState('');
  const [diseaseFilter, setDiseaseFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [minConfidenceFilter, setMinConfidenceFilter] = useState('');
  const [timeWindowFilter, setTimeWindowFilter] = useState('7d');
  const siteFilter = controlledSiteFilter ?? internalSiteFilter;
  const greenhouseFilter = controlledGreenhouseFilter ?? internalGreenhouseFilter;
  const zoneFilter = controlledZoneFilter ?? internalZoneFilter;
  const lineFilter = controlledLineFilter ?? internalLineFilter;
  const capturedAfterFilter = useMemo(
    () => buildCapturedAfterForWindow(timeWindowFilter),
    [timeWindowFilter],
  );
  const hierarchyDiseaseMapParams = useMemo(
    () => ({
      site: siteFilter,
      greenhouse: greenhouseFilter,
      zone: zoneFilter,
      line: lineFilter,
    }),
    [greenhouseFilter, lineFilter, siteFilter, zoneFilter],
  );
  const diseaseMapQueryParams = useMemo(
    () => ({
      ...diseaseMapFilters,
      ...hierarchyDiseaseMapParams,
      ...buildDiseaseFilterParam(diseaseFilter),
      severity: severityFilter,
      min_confidence: minConfidenceFilter,
      captured_after: capturedAfterFilter,
    }),
    [
      capturedAfterFilter,
      diseaseFilter,
      diseaseMapFilters,
      hierarchyDiseaseMapParams,
      minConfidenceFilter,
      severityFilter,
    ],
  );

  const mapDevicesQuery = useQuery({
    queryKey: MAP_DEVICES_QUERY_KEY,
    queryFn: fetchMapDevices,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
  const diseaseMapSignalsQuery = useQuery({
    queryKey: buildDashboardDiseaseMapSignalsQueryKey(diseaseMapQueryParams),
    queryFn: () => fetchDashboardDiseaseMapSignals(diseaseMapQueryParams),
    enabled: enableDiseaseLayers,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
  const diseaseMapFilterOptionsQuery = useQuery({
    queryKey: [
      ...buildDashboardDiseaseMapSignalsQueryKey(hierarchyDiseaseMapParams),
      'filter-options',
    ],
    queryFn: () => fetchDashboardDiseaseMapSignals(hierarchyDiseaseMapParams),
    enabled: enableDiseaseLayers,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const devices = mapDevicesQuery.data ?? EMPTY_DEVICES;
  const diseaseMapData = diseaseMapSignalsQuery.data;
  const diseaseMapSummary = diseaseMapData?.summary ?? EMPTY_DISEASE_MAP_SUMMARY;
  const diseaseSignals = diseaseMapData?.signals ?? EMPTY_DISEASE_SIGNALS;
  const infectionZones = diseaseMapData?.infection_zones ?? EMPTY_INFECTION_ZONES;
  const diseaseOptions = diseaseMapFilterOptionsQuery.data?.filters?.available_diseases
    ?? diseaseMapData?.filters?.available_diseases
    ?? EMPTY_DISEASE_OPTIONS;
  const hierarchyOptions = useMemo(() => buildHierarchyOptions(devices), [devices]);
  const activeHierarchyOptions = {
    siteOptions: controlledSiteOptions ?? hierarchyOptions.siteOptions,
    greenhouseOptions: controlledGreenhouseOptions ?? hierarchyOptions.greenhouseOptions,
    zoneOptions: controlledZoneOptions ?? hierarchyOptions.zoneOptions,
    lineOptions: controlledLineOptions ?? hierarchyOptions.lineOptions,
  };
  const filteredDevices = useMemo(
    () => devices.filter((device) => (
      (!siteFilter || device.site === siteFilter)
      && (!greenhouseFilter || device.greenhouse === greenhouseFilter)
      && (!zoneFilter || device.zone === zoneFilter)
      && (!lineFilter || device.line === lineFilter)
    )),
    [devices, greenhouseFilter, lineFilter, siteFilter, zoneFilter],
  );
  const mappedDevices = useMemo(
    () => filteredDevices.filter(hasGeoCoordinates),
    [filteredDevices],
  );
  const unmappedDeviceCount = filteredDevices.length - mappedDevices.length;
  const devicesWithLocalCoordinates = useMemo(
    () => filteredDevices.filter((device) => isPresent(device.local_x) && isPresent(device.local_y)),
    [filteredDevices],
  );
  const diseaseFiltersActive = Boolean(
    enableDiseaseLayers
    && (diseaseFilter || severityFilter || minConfidenceFilter || timeWindowFilter),
  );

  useEffect(() => {
    if (!mapContainerRef.current || mappedDevices.length === 0) {
      return undefined;
    }

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    const markerLayer = L.layerGroup().addTo(map);
    const diseaseZoneLayer = L.layerGroup().addTo(map);
    const diseaseSignalLayer = L.layerGroup().addTo(map);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);
    const diseaseBounds = L.latLngBounds([]);

    mappedDevices.forEach((device) => {
      const position = toValidPosition(device.latitude, device.longitude);
      if (!position) {
        return;
      }
      bounds.extend(position);

      const marker = L.marker(position, { icon: deviceMarkerIcon })
        .bindPopup(createPopupContent(device))
        .addTo(markerLayer);
      if (diseaseFiltersActive) {
        marker.setOpacity(0.7);
      }

      if (onDeviceSelect) {
        marker.on('click', () => onDeviceSelect(device));
      }

      if (selectedDeviceId && device.id === selectedDeviceId) {
        marker.openPopup();
      }
    });

    if (enableDiseaseLayers) {
      infectionZones.forEach((zone) => {
        const position = toValidPosition(zone.center?.latitude, zone.center?.longitude);
        const radius = Number(zone.radius_meters);

        if (
          !position
          || !Number.isFinite(radius)
          || radius <= 0
        ) {
          return;
        }

        L.circle(position, {
          ...getSemanticZoneStyle(zone),
          radius,
        })
          .bindPopup(createInfectionZonePopupContent(zone))
          .addTo(diseaseZoneLayer);

        // Fit to validated signal/zone centers. Some browsers can become unstable
        // when repeatedly fitting map bounds derived from SVG circle radii.
        diseaseBounds.extend(position);
      });

      diseaseSignals.forEach((signal) => {
        const position = toValidPosition(signal.latitude, signal.longitude);
        if (!position) {
          return;
        }

        L.circleMarker(position, getSemanticSignalStyle(signal, diseaseFiltersActive))
          .bindPopup(createDiseaseSignalPopupContent(signal))
          .addTo(diseaseSignalLayer);
        diseaseBounds.extend(position);
      });
    }

    const selectedMappedDevice = mappedDevices.find((device) => device.id === selectedDeviceId);
    if (selectedMappedDevice) {
      const selectedPosition = toValidPosition(
        selectedMappedDevice.latitude,
        selectedMappedDevice.longitude,
      );
      if (selectedPosition) {
        map.setView(selectedPosition, 17);
      }
    } else if (enableDiseaseLayers && diseaseFiltersActive) {
      const didFitDiseaseBounds = fitMapToBounds(map, diseaseBounds, {
        padding: [36, 36],
        maxZoom: 17,
      });

      if (!didFitDiseaseBounds) {
        fitMapToBounds(map, bounds, {
          padding: [32, 32],
          maxZoom: 17,
        });
      }
    } else {
      fitMapToBounds(map, bounds, {
        padding: [32, 32],
        maxZoom: 17,
      });
    }

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
    };
  }, [
    diseaseFiltersActive,
    diseaseSignals,
    enableDiseaseLayers,
    infectionZones,
    mappedDevices,
    onDeviceSelect,
    selectedDeviceId,
  ]);

  const handleSiteSelect = (value) => {
    if (onSiteFilterChange) {
      onSiteFilterChange(value);
      return;
    }

    setInternalSiteFilter(value);
    setInternalGreenhouseFilter('');
    setInternalZoneFilter('');
    setInternalLineFilter('');
  };

  const handleGreenhouseSelect = (value) => {
    if (onGreenhouseFilterChange) {
      onGreenhouseFilterChange(value);
      return;
    }

    setInternalGreenhouseFilter(value);
    setInternalZoneFilter('');
    setInternalLineFilter('');
  };

  const handleZoneSelect = (value) => {
    if (onZoneFilterChange) {
      onZoneFilterChange(value);
      return;
    }

    setInternalZoneFilter(value);
    setInternalLineFilter('');
  };

  const handleLineSelect = (value) => {
    if (onLineFilterChange) {
      onLineFilterChange(value);
      return;
    }

    setInternalLineFilter(value);
  };

  if (mapDevicesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full max-w-4xl" />
        <Skeleton className="h-[28rem] w-full" />
      </div>
    );
  }

  if (mapDevicesQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Map data unavailable</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {mapDevicesQuery.error?.response?.data?.detail
              || mapDevicesQuery.error?.message
              || 'Failed to load map-ready devices.'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => mapDevicesQuery.refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        {showFilters ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={siteFilter}
              onChange={(event) => handleSiteSelect(event.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All sites</option>
              {activeHierarchyOptions.siteOptions.map((site) => (
                <option key={site.id} value={site.id}>{site.label}</option>
              ))}
            </select>
            <select
              value={greenhouseFilter}
              onChange={(event) => handleGreenhouseSelect(event.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All greenhouses</option>
              {activeHierarchyOptions.greenhouseOptions.map((greenhouse) => (
                <option key={greenhouse.id} value={greenhouse.id}>{greenhouse.label}</option>
              ))}
            </select>
            <select
              value={zoneFilter}
              onChange={(event) => handleZoneSelect(event.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All zones</option>
              {activeHierarchyOptions.zoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.label}</option>
              ))}
            </select>
            <select
              value={lineFilter}
              onChange={(event) => handleLineSelect(event.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All lines</option>
              {activeHierarchyOptions.lineOptions.map((line) => (
                <option key={line.id} value={line.id}>{line.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        {enableDiseaseLayers ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <DiseaseFilterControl
              label="Disease"
              value={diseaseFilter}
              onChange={setDiseaseFilter}
            >
              <option value="">All diseases</option>
              {diseaseOptions.map((disease) => (
                <option key={disease.id || disease.key} value={toDiseaseFilterValue(disease)}>
                  {disease.name} ({disease.count})
                </option>
              ))}
            </DiseaseFilterControl>
            <DiseaseFilterControl
              label="Severity"
              value={severityFilter}
              onChange={setSeverityFilter}
            >
              <option value="">All severities</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </DiseaseFilterControl>
            <DiseaseFilterControl
              label="Confidence"
              value={minConfidenceFilter}
              onChange={setMinConfidenceFilter}
            >
              {CONFIDENCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </DiseaseFilterControl>
            <DiseaseFilterControl
              label="Time window"
              value={timeWindowFilter}
              onChange={setTimeWindowFilter}
            >
              {TIME_WINDOW_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </DiseaseFilterControl>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{mappedDevices.length} mapped</Badge>
          <Badge variant="outline">{unmappedDeviceCount} unmapped</Badge>
          {enableDiseaseLayers ? (
            <>
              <Badge variant="outline">{diseaseMapSummary.mapped_signals} disease signals</Badge>
              <Badge variant="outline">{diseaseMapSummary.infection_zone_count} estimated zones</Badge>
              <Badge variant="outline">{diseaseMapSummary.unmapped_signals} unmapped signals</Badge>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              mapDevicesQuery.refetch();
              if (enableDiseaseLayers) {
                diseaseMapSignalsQuery.refetch();
                diseaseMapFilterOptionsQuery.refetch();
              }
            }}
            disabled={
              mapDevicesQuery.isFetching
              || diseaseMapSignalsQuery.isFetching
              || diseaseMapFilterOptionsQuery.isFetching
            }
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                (
                  mapDevicesQuery.isFetching
                  || diseaseMapSignalsQuery.isFetching
                  || diseaseMapFilterOptionsQuery.isFetching
                ) && 'animate-spin',
              )}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {enableDiseaseLayers ? (
        <DiseaseMapLayerStatus
          query={diseaseMapSignalsQuery}
          summary={diseaseMapSummary}
        />
      ) : null}

      {enableDiseaseLayers ? <DiseaseMapLegend /> : null}

      {mappedDevices.length > 0 ? (
        <div className="h-[28rem] overflow-hidden rounded-md border border-border bg-muted">
          <div ref={mapContainerRef} className="h-full w-full" aria-label="Device location map" />
        </div>
      ) : (
        <div className="flex h-[28rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
          <div className="mb-3 rounded-full border border-border bg-background p-3 text-muted-foreground">
            <MapPinned className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No mapped devices yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add latitude and longitude to devices to display them on the dashboard map.
            {devicesWithLocalCoordinates.length > 0
              ? ` ${devicesWithLocalCoordinates.length} device${devicesWithLocalCoordinates.length === 1 ? '' : 's'} already have local schematic coordinates for a future internal layout.`
              : ''}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Uses OpenStreetMap raster tiles without paid tokens. Local deployments can swap the tile source later.
      </p>
    </div>
  );
}
