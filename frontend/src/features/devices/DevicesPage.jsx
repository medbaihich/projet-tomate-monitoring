import { useMemo, useState } from 'react';
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
import { createDevice, fetchDevicesHierarchy } from '@/features/devices/api';
import useAuthStore from '@/store/authStore';

function buildDefaultExpandedItems(sites) {
  const expandedItems = [];

  for (const site of sites) {
    expandedItems.push(`site:${site.id}`);

    for (const greenhouse of site.greenhouses) {
      expandedItems.push(`greenhouse:${greenhouse.id}`);
    }
  }

  return expandedItems;
}

function flattenZones(sites) {
  return sites.flatMap((site) =>
    site.greenhouses.flatMap((greenhouse) =>
      greenhouse.zones.map((zone) => ({
        id: zone.id,
        label: `${site.name} / ${greenhouse.name} / ${zone.name}`,
      })),
    ),
  );
}

function findDeviceWithPath(sites, deviceId) {
  for (const site of sites) {
    for (const greenhouse of site.greenhouses) {
      for (const zone of greenhouse.zones) {
        const device = zone.devices.find((item) => item.id === deviceId);
        if (device) {
          return {
            device,
            path: {
              siteName: site.name,
              greenhouseName: greenhouse.name,
              zoneName: zone.name,
            },
          };
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
  const { data: sites = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['devices-hierarchy'],
    queryFn: fetchDevicesHierarchy,
  });

  const [expandedItems, setExpandedItems] = useState(null);

  const defaultExpandedItems = useMemo(() => buildDefaultExpandedItems(sites), [sites]);
  const availableZones = useMemo(() => flattenZones(sites), [sites]);
  const visibleExpandedItems = expandedItems ?? defaultExpandedItems;

  const selectedItemId = selectedDevice ? `device:${selectedDevice.id}` : null;

  const handleSelectDevice = (device, path) => {
    setSelectedDevice(device);
    setSelectedPath(path);
  };

  const createDeviceMutation = useMutation({
    mutationFn: createDevice,
  });

  const handleCreateDevice = async (payload) => {
    const createdDevice = await createDeviceMutation.mutateAsync(payload);
    const refreshed = await refetch();
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
        message="The backend returned no sites, greenhouses, zones, or devices yet."
        minHeight={280}
      />
    );
  }

  return (
    <Stack spacing={1.75}>
      <PageHeader
        eyebrow="Infrastructure"
        title="Devices"
        subtitle="Live hierarchy from the devices API: Site -> Greenhouse -> Zone -> Device."
        actions={isAdmin ? (
          <Button
            variant="contained"
            onClick={() => {
              setCreateDialogSession((currentValue) => currentValue + 1);
              setIsCreateDialogOpen(true);
            }}
            disabled={availableZones.length === 0}
          >
            Add device
          </Button>
        ) : null}
      />

      <Grid container spacing={1.75}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <PanelCard
            title="Hierarchy"
            subtitle="Operational device structure grouped by site, greenhouse, and zone."
            badge={`${sites.length} site${sites.length === 1 ? '' : 's'}`}
          >
            <DevicesTree
              sites={sites}
              selectedItemId={selectedItemId}
              expandedItems={visibleExpandedItems}
              onExpandedItemsChange={(_, itemIds) => setExpandedItems(itemIds)}
              onSelectedItemsChange={() => {}}
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
        zones={availableZones}
        initialZoneId={selectedDevice?.zone || ''}
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
