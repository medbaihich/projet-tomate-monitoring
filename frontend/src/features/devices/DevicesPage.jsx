import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  Snackbar,
  Stack,
} from '@mui/material';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import CreateDeviceDialog from '@/features/devices/CreateDeviceDialog';
import DeleteDeviceDialog from '@/features/devices/DeleteDeviceDialog';
import DeviceLocationMapDialog from '@/features/devices/DeviceLocationMapDialog';
import EditDeviceDialog from '@/features/devices/EditDeviceDialog';
import DevicesTable from '@/features/devices/components/DevicesTable';
import DeviceDetailDrawer from '@/features/devices/DeviceDetailDrawer';
import {
  createDevice,
  deleteDevice,
  DEVICES_FILTER_OPTIONS_QUERY_KEY,
  DEVICE_LINES_QUERY_KEY,
  DEVICES_TABLE_QUERY_KEY,
  fetchDevicesFilterOptions,
  fetchDevicesPage,
  fetchLines,
  updateDevice,
} from '@/features/devices/api';
import { resolveErrorMessage } from '@/features/devices/deviceFormUtils';
import useAuthStore from '@/store/authStore';

function toHierarchyPath(device) {
  return {
    siteName: device?.site_name || '',
    greenhouseName: device?.greenhouse_name || '',
    zoneName: device?.zone_name || '',
    lineName: device?.line_name || '',
  };
}

function toLineOption(line, context) {
  const zoneName = line.zone_name || 'Zone';
  const code = line.code ? ` (${line.code})` : '';

  return {
    id: line.id,
    label: context
      ? `${context.siteName} / ${context.greenhouseName} / ${context.zoneName} / ${line.name}${code}`
      : `${zoneName} / ${line.name}${code}`,
  };
}

function applyUpdater(updater, currentValue) {
  return typeof updater === 'function' ? updater(currentValue) : updater;
}

function addOption(map, id, label) {
  if (!id || map.has(id)) {
    return;
  }

  map.set(id, {
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
  const lineContexts = new Map();

  for (const device of devices) {
    addOption(sites, device.site, device.site_name);
    addOption(greenhouses, device.greenhouse, device.greenhouse_name);
    addOption(zones, device.zone, device.zone_name);

    if (device.line && !lineContexts.has(device.line)) {
      lineContexts.set(device.line, {
        siteName: device.site_name || 'Site',
        greenhouseName: device.greenhouse_name || 'Greenhouse',
        zoneName: device.zone_name || 'Zone',
      });
    }
  }

  return {
    siteOptions: sortOptions(sites.values()),
    greenhouseOptions: sortOptions(greenhouses.values()),
    zoneOptions: sortOptions(zones.values()),
    lineContexts,
  };
}

export default function DevicesPage() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogSession, setCreateDialogSession] = useState(0);
  const [editDialogSession, setEditDialogSession] = useState(0);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deletingDevice, setDeletingDevice] = useState(null);
  const [deviceMapDialogDevice, setDeviceMapDialogDevice] = useState(null);
  const [deleteNotice, setDeleteNotice] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [sorting, setSorting] = useState([]);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [greenhouseFilter, setGreenhouseFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const roleName = useAuthStore((state) => state.user?.role?.name || '');
  const isAdmin = roleName.trim().toLowerCase() === 'admin';

  const devicesQuery = useQuery({
    queryKey: [
      ...DEVICES_TABLE_QUERY_KEY,
      {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        search,
        site: siteFilter,
        greenhouse: greenhouseFilter,
        zone: zoneFilter,
        line: lineFilter,
        sorting,
      },
    ],
    queryFn: () => fetchDevicesPage({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search,
      site: siteFilter,
      greenhouse: greenhouseFilter,
      zone: zoneFilter,
      line: lineFilter,
      sorting,
    }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const linesQuery = useQuery({
    queryKey: DEVICE_LINES_QUERY_KEY,
    queryFn: fetchLines,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
  const filterOptionsQuery = useQuery({
    queryKey: DEVICES_FILTER_OPTIONS_QUERY_KEY,
    queryFn: fetchDevicesFilterOptions,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
  const devicesData = devicesQuery.data ?? {};
  const devices = devicesData.results ?? [];
  const totalCount = devicesData.count ?? 0;
  const hierarchyOptions = useMemo(
    () => buildHierarchyOptions(filterOptionsQuery.data ?? []),
    [filterOptionsQuery.data],
  );
  const availableLines = useMemo(
    () => (linesQuery.data ?? []).map((line) =>
      toLineOption(line, hierarchyOptions.lineContexts.get(line.id)),
    ),
    [hierarchyOptions.lineContexts, linesQuery.data],
  );

  const handleSelectDevice = useCallback((device, path) => {
    setSelectedDevice(device);
    setSelectedPath(path ?? toHierarchyPath(device));
  }, []);
  const handleCloseDeviceDetails = useCallback(() => {
    setSelectedDevice(null);
    setSelectedPath(null);
  }, []);
  const handlePaginationChange = useCallback((updater) => {
    setPagination((currentValue) => applyUpdater(updater, currentValue));
  }, []);
  const handleSortingChange = useCallback((updater) => {
    setSorting((currentValue) => applyUpdater(updater, currentValue));
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);
  const handleSearchChange = useCallback((nextSearch) => {
    setSearch(nextSearch);
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);
  const handleSiteFilterChange = useCallback((nextSite) => {
    setSiteFilter(nextSite);
    setGreenhouseFilter('');
    setZoneFilter('');
    setLineFilter('');
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);
  const handleGreenhouseFilterChange = useCallback((nextGreenhouse) => {
    setGreenhouseFilter(nextGreenhouse);
    setZoneFilter('');
    setLineFilter('');
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);
  const handleZoneFilterChange = useCallback((nextZone) => {
    setZoneFilter(nextZone);
    setLineFilter('');
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);
  const handleLineFilterChange = useCallback((nextLine) => {
    setLineFilter(nextLine);
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);

  const createDeviceMutation = useMutation({
    mutationFn: createDevice,
  });
  const updateDeviceMutation = useMutation({
    mutationFn: updateDevice,
  });
  const deleteDeviceMutation = useMutation({
    mutationFn: deleteDevice,
  });

  const refreshDevicesData = useCallback(async () => {
    await Promise.all([
      devicesQuery.refetch(),
      filterOptionsQuery.refetch(),
    ]);
  }, [devicesQuery, filterOptionsQuery]);

  const handleCreateDevice = async (payload) => {
    const createdDevice = await createDeviceMutation.mutateAsync(payload);
    await refreshDevicesData();
    handleSelectDevice(createdDevice);

    setIsCreateDialogOpen(false);
    setSuccessMessage(`Device "${createdDevice.name}" created successfully.`);
    return createdDevice;
  };

  const handleEditDevice = useCallback((device) => {
    setEditDialogSession((currentValue) => currentValue + 1);
    setEditingDevice(device);
  }, []);

  const handleUpdateDevice = async (payload) => {
    const updatedDevice = await updateDeviceMutation.mutateAsync(payload);
    await refreshDevicesData();

    if (selectedDevice?.id === updatedDevice.id) {
      handleSelectDevice(updatedDevice);
    }

    setEditingDevice(null);
    setSuccessMessage(`Device "${updatedDevice.name}" updated successfully.`);
    return updatedDevice;
  };

  const handleOpenDeleteDialog = useCallback((device) => {
    setDeleteNotice('');
    setDeletingDevice(device);
  }, []);

  const handleDeleteDevice = async () => {
    if (!deletingDevice) {
      return;
    }

    try {
      await deleteDeviceMutation.mutateAsync(deletingDevice.id);
      await refreshDevicesData();

      if (selectedDevice?.id === deletingDevice.id) {
        handleCloseDeviceDetails();
      }

      if (editingDevice?.id === deletingDevice.id) {
        setEditingDevice(null);
      }

      if (deviceMapDialogDevice?.id === deletingDevice.id) {
        setDeviceMapDialogDevice(null);
      }

      setSuccessMessage(`Device "${deletingDevice.name}" deleted successfully.`);
      setDeletingDevice(null);
      setDeleteNotice('');
    } catch (error) {
      setDeleteNotice(resolveErrorMessage(error, 'Unable to delete the device.'));
    }
  };

  const handleShowDeviceOnMap = useCallback((device) => {
    setDeviceMapDialogDevice(device);
  }, []);

  return (
    <Stack spacing={1.75}>
      <PageHeader
        title="Devices"
        actions={isAdmin ? (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => {
              setCreateDialogSession((currentValue) => currentValue + 1);
              setIsCreateDialogOpen(true);
            }}
            disabled={availableLines.length === 0 || linesQuery.isLoading}
            sx={{
              minHeight: 30,
              minWidth: 'fit-content',
              px: 1.2,
              borderRadius: 1.5,
              fontSize: '0.74rem',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '0.01em',
              textTransform: 'none',
              boxShadow: 'none',
              bgcolor: '#1D6B43',
              border: '1px solid rgba(187, 247, 208, 0.14)',
              '& .MuiButton-startIcon': {
                mr: 0.55,
                ml: 0,
              },
              '& .MuiSvgIcon-root': {
                fontSize: '0.95rem',
              },
              '&:hover': {
                bgcolor: '#185838',
                boxShadow: 'none',
              },
            }}
          >
            Add device
          </Button>
        ) : null}
      />

      <PanelCard
        title="Device registry"
        subtitle="Compact table backed by the devices list API."
        badge={`${totalCount} device${totalCount === 1 ? '' : 's'}`}
      >
        {devicesQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => devicesQuery.refetch()}>
                Retry
              </Button>
            }
          >
            {devicesQuery.error?.response?.data?.detail
              || devicesQuery.error?.message
              || 'Failed to load devices.'}
          </Alert>
        ) : (
          <DevicesTable
            devices={devices}
            totalCount={totalCount}
            isLoading={devicesQuery.isLoading}
            isFetching={devicesQuery.isFetching}
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            sorting={sorting}
            search={search}
            siteFilter={siteFilter}
            greenhouseFilter={greenhouseFilter}
            zoneFilter={zoneFilter}
            lineFilter={lineFilter}
            siteOptions={hierarchyOptions.siteOptions}
            greenhouseOptions={hierarchyOptions.greenhouseOptions}
            zoneOptions={hierarchyOptions.zoneOptions}
            lineOptions={availableLines}
            selectedDeviceId={selectedDevice?.id || ''}
            onPaginationChange={handlePaginationChange}
            onSortingChange={handleSortingChange}
            onSearchChange={handleSearchChange}
            onSiteFilterChange={handleSiteFilterChange}
            onGreenhouseFilterChange={handleGreenhouseFilterChange}
            onZoneFilterChange={handleZoneFilterChange}
            onLineFilterChange={handleLineFilterChange}
            onSelectDevice={handleSelectDevice}
            onRefresh={() => devicesQuery.refetch()}
            isAdmin={isAdmin}
            onEditDevice={handleEditDevice}
            onDeleteDevice={handleOpenDeleteDialog}
            onShowDeviceOnMap={handleShowDeviceOnMap}
          />
        )}
      </PanelCard>

      <DeviceDetailDrawer
        open={Boolean(selectedDevice)}
        device={selectedDevice}
        hierarchyPath={selectedPath}
        onClose={handleCloseDeviceDetails}
      />

      <CreateDeviceDialog
        key={createDialogSession}
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateDevice}
        isSubmitting={createDeviceMutation.isPending}
        lines={availableLines}
        initialLineId={selectedDevice?.line || ''}
      />

      <EditDeviceDialog
        key={editDialogSession}
        open={Boolean(editingDevice)}
        device={editingDevice}
        onClose={() => setEditingDevice(null)}
        onSubmit={handleUpdateDevice}
        isSubmitting={updateDeviceMutation.isPending}
        lines={availableLines}
      />

      <DeleteDeviceDialog
        open={Boolean(deletingDevice)}
        device={deletingDevice}
        notice={deleteNotice}
        isSubmitting={deleteDeviceMutation.isPending}
        onClose={() => {
          setDeletingDevice(null);
          setDeleteNotice('');
        }}
        onConfirm={handleDeleteDevice}
      />

      <DeviceLocationMapDialog
        open={Boolean(deviceMapDialogDevice)}
        device={deviceMapDialogDevice}
        onClose={() => setDeviceMapDialogDevice(null)}
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
