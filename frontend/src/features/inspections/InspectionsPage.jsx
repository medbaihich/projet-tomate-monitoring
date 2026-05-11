import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import {
  fetchInspectionReferenceData,
  fetchInspectionById,
  fetchInspectionsPage,
  INSPECTION_REFERENCE_DATA_QUERY_KEY,
  INSPECTIONS_WORKSPACE_QUERY_KEY,
} from '@/features/inspections/api';
import HistoricalDiseaseMap from '@/features/inspections/HistoricalDiseaseMap';
import InspectionDetailDrawer from '@/features/inspections/InspectionDetailDrawer';
import InspectionsTable from '@/features/inspections/components/InspectionsTable';

const DEFAULT_PAGINATION = {
  pageIndex: 0,
  pageSize: 20,
};

const DEFAULT_SORTING = [
  {
    id: 'captured_at',
    desc: true,
  },
];

function buildMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

const DEFAULT_DRAWER_STATE = {
  open: false,
  inspection: null,
  loading: false,
  errorMessage: '',
  contextSignal: null,
};
const FILTER_SELECT_CLASS = 'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const DEFAULT_FILTERS = {
  search: '',
  disease: '',
  organ_type: '',
  device: '',
  status: '',
  processing_status: '',
};
const ORGAN_OPTIONS = [
  { value: '', label: 'All organs' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'leaf', label: 'Leaf' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'closed', label: 'Closed' },
];
const PROCESSING_OPTIONS = [
  { value: '', label: 'All processing states' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function formatFilterLabel(value) {
  if (!value) {
    return 'N/A';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function InspectionsPage() {
  const [drawerState, setDrawerState] = useState(DEFAULT_DRAWER_STATE);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [sorting, setSorting] = useState(DEFAULT_SORTING);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const selectionRequestRef = useRef(0);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => Boolean(value)),
    [filters],
  );
  const tableFilters = useMemo(
    () => ({
      search: deferredSearch,
      predicted_disease: filters.disease,
      organ_type: filters.organ_type,
      device: filters.device,
      status: filters.status,
      processing_status: filters.processing_status,
    }),
    [deferredSearch, filters.device, filters.disease, filters.organ_type, filters.processing_status, filters.status],
  );
  const mapFilters = useMemo(
    () => ({
      disease: filters.disease,
      organ_type: filters.organ_type,
      device: filters.device,
      status: filters.status,
      processing_status: filters.processing_status,
    }),
    [filters.device, filters.disease, filters.organ_type, filters.processing_status, filters.status],
  );

  const inspectionsQuery = useQuery({
    queryKey: [
      ...INSPECTIONS_WORKSPACE_QUERY_KEY,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      tableFilters,
    ],
    queryFn: () => fetchInspectionsPage({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sorting,
      filters: tableFilters,
    }),
    placeholderData: (previousData) => previousData,
  });

  const referenceQuery = useQuery({
    queryKey: INSPECTION_REFERENCE_DATA_QUERY_KEY,
    queryFn: fetchInspectionReferenceData,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const inspections = useMemo(() => inspectionsQuery.data?.results ?? [], [inspectionsQuery.data?.results]);
  const totalInspections = inspectionsQuery.data?.count ?? 0;
  const devices = useMemo(() => referenceQuery.data?.devices ?? [], [referenceQuery.data?.devices]);
  const diseases = useMemo(() => referenceQuery.data?.diseases ?? [], [referenceQuery.data?.diseases]);
  const deviceMap = useMemo(() => buildMap(devices), [devices]);
  const diseaseMap = useMemo(() => buildMap(diseases), [diseases]);
  const deviceOptions = useMemo(
    () => [...devices]
      .map((device) => ({
        value: device.id,
        label: `${device.name} (${device.identifier})`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [devices],
  );
  const diseaseOptions = useMemo(
    () => [...diseases]
      .map((disease) => ({
        value: disease.id,
        label: `${disease.name} - ${formatFilterLabel(disease.organ_type).toLowerCase()}`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [diseases],
  );

  const selectedInspection = useMemo(
    () => inspections.find((inspection) => inspection.id === drawerState.inspection?.id) ?? drawerState.inspection,
    [drawerState.inspection, inspections],
  );
  const visibleSelectedInspectionId = useMemo(
    () => (
      selectedInspection && inspections.some((inspection) => inspection.id === selectedInspection.id)
        ? selectedInspection.id
        : null
    ),
    [inspections, selectedInspection],
  );

  const handleSelectInspection = useCallback((inspection) => {
    selectionRequestRef.current += 1;
    setDrawerState(
      inspection
        ? {
          open: true,
          inspection,
          loading: false,
          errorMessage: '',
          contextSignal: null,
        }
        : DEFAULT_DRAWER_STATE,
    );
  }, []);
  const handleCloseInspectionDetails = useCallback(() => {
    selectionRequestRef.current += 1;
    setDrawerState(DEFAULT_DRAWER_STATE);
  }, []);
  const handleSelectInspectionFromMap = useCallback(async (signal) => {
    if (!signal?.inspection_id) {
      return;
    }

    const inspectionOnPage = inspections.find((inspection) => inspection.id === signal.inspection_id);
    if (inspectionOnPage) {
      selectionRequestRef.current += 1;
      setDrawerState({
        open: true,
        inspection: inspectionOnPage,
        loading: false,
        errorMessage: '',
        contextSignal: signal,
      });
      return;
    }

    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setDrawerState({
      open: true,
      inspection: null,
      loading: true,
      errorMessage: '',
      contextSignal: signal,
    });

    try {
      const inspection = await fetchInspectionById(signal.inspection_id);

      if (selectionRequestRef.current !== requestId) {
        return;
      }

      setDrawerState({
        open: true,
        inspection,
        loading: false,
        errorMessage: '',
        contextSignal: signal,
      });
    } catch (error) {
      if (selectionRequestRef.current !== requestId) {
        return;
      }

      setDrawerState({
        open: true,
        inspection: null,
        loading: false,
        errorMessage: error?.response?.data?.detail || error?.message || 'Failed to load inspection details.',
        contextSignal: signal,
      });
    }
  }, [inspections]);
  const handlePaginationChange = useCallback((updater) => {
    setPagination((currentValue) => (typeof updater === 'function' ? updater(currentValue) : updater));
  }, []);
  const handleSortingChange = useCallback((updater) => {
    const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
    setSorting(nextSorting?.length ? nextSorting : DEFAULT_SORTING);
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, [sorting]);
  const updateFilter = useCallback((name, value) => {
    setFilters((currentValue) => ({
      ...currentValue,
      [name]: value,
    }));
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);
  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
  }, []);

  if (inspectionsQuery.isLoading || referenceQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading inspections...</Typography>
        </Stack>
      </Box>
    );
  }

  if (inspectionsQuery.isError || referenceQuery.isError) {
    const activeError = inspectionsQuery.error || referenceQuery.error;

    return (
      <Alert
        severity="error"
        action={(
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              inspectionsQuery.refetch();
              referenceQuery.refetch();
            }}
          >
            Retry
          </Button>
        )}
      >
        {activeError?.response?.data?.detail || activeError?.message || 'Failed to load inspections.'}
      </Alert>
    );
  }

  return (
    <>
      <Stack spacing={1.75}>
        <PageHeader
          eyebrow="Operations"
          title="Inspections"
          subtitle="Browse inspection records from the inspections API and inspect the operational details of the selected record."
        />

        <PanelCard
          title="Inspection registry"
          subtitle="Compact paginated inspection table backed by the inspections API."
          badge={`${totalInspections} inspection${totalInspections === 1 ? '' : 's'}`}
        >
          <Stack spacing={1.25} sx={{ mb: 1.5 }}>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <Input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Search disease, device, message..."
                aria-label="Search inspections"
              />

              <select
                value={filters.disease}
                onChange={(event) => updateFilter('disease', event.target.value)}
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by disease"
              >
                <option value="">All diseases</option>
                {diseaseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.organ_type}
                onChange={(event) => updateFilter('organ_type', event.target.value)}
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by organ"
              >
                {ORGAN_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.device}
                onChange={(event) => updateFilter('device', event.target.value)}
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by device"
              >
                <option value="">All devices</option>
                {deviceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.processing_status}
                onChange={(event) => updateFilter('processing_status', event.target.value)}
                className={FILTER_SELECT_CLASS}
                aria-label="Filter by processing status"
              >
                {PROCESSING_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
              <p>
                Search narrows the registry table only. Disease, organ, device, status, and processing filters are shared with the historical map. The historical map remains limited to completed disease-positive inspections.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          </Stack>

          <InspectionsTable
            inspections={inspections}
            totalCount={totalInspections}
            isLoading={inspectionsQuery.isLoading}
            isFetching={inspectionsQuery.isFetching}
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            sorting={sorting}
            selectedInspectionId={visibleSelectedInspectionId || ''}
            deviceMap={deviceMap}
            diseaseMap={diseaseMap}
            onPaginationChange={handlePaginationChange}
            onSortingChange={handleSortingChange}
            onSelectInspection={handleSelectInspection}
            onRefresh={() => inspectionsQuery.refetch()}
          />
        </PanelCard>

        <PanelCard
          title="Historical Disease Map"
          subtitle="Archived disease detections shown at device locations with DB-backed spread zones."
        >
          <HistoricalDiseaseMap
            filters={mapFilters}
            selectedInspectionId={selectedInspection?.id || ''}
            onSignalSelect={handleSelectInspectionFromMap}
          />
        </PanelCard>
      </Stack>

      <InspectionDetailDrawer
        open={drawerState.open}
        onClose={handleCloseInspectionDetails}
        inspection={selectedInspection}
        deviceMap={deviceMap}
        diseaseMap={diseaseMap}
        isLoading={drawerState.loading}
        errorMessage={drawerState.errorMessage}
        contextSignal={drawerState.contextSignal}
        onRetry={
          drawerState.contextSignal
            ? () => handleSelectInspectionFromMap(drawerState.contextSignal)
            : undefined
        }
      />
    </>
  );
}
