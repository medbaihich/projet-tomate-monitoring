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
import { fetchMapDevices, MAP_DEVICES_QUERY_KEY } from '@/features/map/api';

const FILTER_SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const EMPTY_DEVICES = [];
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

export default function MapFoundation({
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
  const siteFilter = controlledSiteFilter ?? internalSiteFilter;
  const greenhouseFilter = controlledGreenhouseFilter ?? internalGreenhouseFilter;
  const zoneFilter = controlledZoneFilter ?? internalZoneFilter;
  const lineFilter = controlledLineFilter ?? internalLineFilter;

  const mapDevicesQuery = useQuery({
    queryKey: MAP_DEVICES_QUERY_KEY,
    queryFn: fetchMapDevices,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const devices = mapDevicesQuery.data ?? EMPTY_DEVICES;
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

  useEffect(() => {
    if (!mapContainerRef.current || mappedDevices.length === 0) {
      return undefined;
    }

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    const markerLayer = L.layerGroup().addTo(map);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];

    mappedDevices.forEach((device) => {
      const latitude = toCoordinate(device.latitude);
      const longitude = toCoordinate(device.longitude);
      const position = [latitude, longitude];
      bounds.push(position);

      const marker = L.marker(position, { icon: deviceMarkerIcon })
        .bindPopup(createPopupContent(device))
        .addTo(markerLayer);

      if (onDeviceSelect) {
        marker.on('click', () => onDeviceSelect(device));
      }

      if (selectedDeviceId && device.id === selectedDeviceId) {
        marker.openPopup();
      }
    });

    const selectedMappedDevice = mappedDevices.find((device) => device.id === selectedDeviceId);
    if (selectedMappedDevice) {
      map.setView(
        [Number(selectedMappedDevice.latitude), Number(selectedMappedDevice.longitude)],
        17,
      );
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 17);
    } else {
      map.fitBounds(bounds, {
        padding: [32, 32],
        maxZoom: 17,
      });
    }

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
    };
  }, [mappedDevices, onDeviceSelect, selectedDeviceId]);

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

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{mappedDevices.length} mapped</Badge>
          <Badge variant="outline">{unmappedDeviceCount} unmapped</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => mapDevicesQuery.refetch()}
            disabled={mapDevicesQuery.isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', mapDevicesQuery.isFetching && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

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
