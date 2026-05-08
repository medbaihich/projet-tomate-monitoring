import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import CreateDeviceDialog from '@/features/devices/CreateDeviceDialog';
import StateBlock from '@/components/ui/StateBlock';
import DevicesTree from '@/features/devices/DevicesTree';
import DeviceDetailCard from '@/features/devices/DeviceDetailCard';
import {
  createDevice,
  DEVICES_HIERARCHY_QUERY_KEY,
  fetchDevicesHierarchy,
} from '@/features/devices/api';
import useAuthStore from '@/store/authStore';

function buildDefaultExpandedItems(sites) {
  const expandedItems = [];

  for (const site of sites) {
    expandedItems.push(`site:${site.id}`);

    for (const greenhouse of site.greenhouses) {
      expandedItems.push(`greenhouse:${greenhouse.id}`);

      for (const zone of greenhouse.zones) {
        expandedItems.push(`zone:${zone.id}`);

        for (const line of zone.lines) {
          expandedItems.push(`line:${line.id}`);
        }
      }
    }
  }

  return expandedItems;
}

function flattenLines(sites) {
  return sites.flatMap((site) =>
    site.greenhouses.flatMap((greenhouse) =>
      greenhouse.zones.flatMap((zone) =>
        zone.lines.map((line) => ({
          id: line.id,
          label: `${site.name} / ${greenhouse.name} / ${zone.name} / ${line.name}`,
        })),
      ),
    ),
  );
}

function findDeviceWithPath(sites, deviceId) {
  for (const site of sites) {
    for (const greenhouse of site.greenhouses) {
      for (const zone of greenhouse.zones) {
        for (const line of zone.lines) {
          const device = line.devices.find((item) => item.id === deviceId);
          if (device) {
            return {
              device,
              path: {
                siteName: site.name,
                greenhouseName: greenhouse.name,
                zoneName: zone.name,
                lineName: line.name,
              },
            };
          }
        }
      }
    }
  }

  return null;
}

export default function DevicesPage() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogSession, setCreateDialogSession] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const roleName = useAuthStore((state) => state.user?.role?.name || '');
  const isAdmin = roleName.trim().toLowerCase() === 'admin';
  const hierarchyQuery = useQuery({
    queryKey: DEVICES_HIERARCHY_QUERY_KEY,
    queryFn: fetchDevicesHierarchy,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
  const { data: sites = [], isLoading, isError, error, refetch } = hierarchyQuery;

  const [expandedItems, setExpandedItems] = useState(null);

  const defaultExpandedItems = useMemo(() => buildDefaultExpandedItems(sites), [sites]);
  const availableLines = useMemo(() => flattenLines(sites), [sites]);
  const visibleExpandedItems = expandedItems ?? defaultExpandedItems;

  const selectedItemId = selectedDevice ? `device:${selectedDevice.id}` : null;

  const handleSelectDevice = useCallback((device, path) => {
    setSelectedDevice(device);
    setSelectedPath(path);
  }, []);
  const handleExpandedItemsChange = useCallback((_, itemIds) => {
    setExpandedItems(itemIds);
  }, []);
  const handleSelectedItemsChange = useCallback(() => {}, []);

  const createDeviceMutation = useMutation({
    mutationFn: createDevice,
  });

  const handleCreateDevice = async (payload) => {
    const createdDevice = await createDeviceMutation.mutateAsync(payload);
    const refreshed = await hierarchyQuery.refetch();
    const nextSites = refreshed.data ?? [];
    const locatedDevice = findDeviceWithPath(nextSites, createdDevice.id);

    if (locatedDevice) {
      setSelectedDevice(locatedDevice.device);
      setSelectedPath(locatedDevice.path);
    }

    setIsCreateDialogOpen(false);
    setSuccessMessage(`Device "${createdDevice.name}" created successfully.`);
    return createdDevice;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading devices hierarchy...</Typography>
        </Stack>
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        {error?.response?.data?.detail || error?.message || 'Failed to load devices hierarchy.'}
      </Alert>
    );
  }

  if (sites.length === 0) {
    return (
      <StateBlock
        title="No device hierarchy found"
        message="The backend returned no sites, greenhouses, zones, lines, or devices yet."
        minHeight={280}
      />
    );
  }

  return (
    <Stack spacing={1.75}>
      <PageHeader
        eyebrow="Infrastructure"
        title="Devices"
        subtitle="Live hierarchy from the devices API: Site -> Greenhouse -> Zone -> Line -> Device."
        actions={isAdmin ? (
          <Button
            variant="contained"
            onClick={() => {
              setCreateDialogSession((currentValue) => currentValue + 1);
              setIsCreateDialogOpen(true);
            }}
            disabled={availableLines.length === 0}
          >
            Add device
          </Button>
        ) : null}
      />

      <Grid container spacing={1.75}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <PanelCard
            title="Hierarchy"
            subtitle="Operational device structure grouped by site, greenhouse, zone, and line."
            badge={`${sites.length} site${sites.length === 1 ? '' : 's'}`}
          >
            <DevicesTree
              sites={sites}
              selectedItemId={selectedItemId}
              expandedItems={visibleExpandedItems}
              onExpandedItemsChange={handleExpandedItemsChange}
              onSelectedItemsChange={handleSelectedItemsChange}
              onSelectDevice={handleSelectDevice}
            />
          </PanelCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <DeviceDetailCard
            device={selectedDevice}
            hierarchyPath={selectedPath}
          />
        </Grid>
      </Grid>
      <CreateDeviceDialog
        key={createDialogSession}
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateDevice}
        isSubmitting={createDeviceMutation.isPending}
        lines={availableLines}
        initialLineId={selectedDevice?.line || ''}
      />

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Stack>
  );
}
