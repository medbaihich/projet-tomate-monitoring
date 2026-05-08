import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import PageHeader from '@/components/ui/PageHeader';
import StateBlock from '@/components/ui/StateBlock';
import {
  fetchInspectionReferenceData,
  fetchInspectionsPage,
  INSPECTION_REFERENCE_DATA_QUERY_KEY,
  INSPECTIONS_WORKSPACE_QUERY_KEY,
} from '@/features/inspections/api';
import InspectionDetailPanel from '@/features/inspections/InspectionDetailPanel';
import InspectionsList from '@/features/inspections/InspectionsList';

const DEFAULT_PAGINATION_MODEL = {
  page: 0,
  pageSize: 20,
};

const DEFAULT_SORT_MODEL = [
  {
    field: 'captured_at',
    sort: 'desc',
  },
];

function buildMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

export default function InspectionsPage() {
  const [selectedInspectionSnapshot, setSelectedInspectionSnapshot] = useState(null);
  const [paginationModel, setPaginationModel] = useState(DEFAULT_PAGINATION_MODEL);
  const [sortModel, setSortModel] = useState(DEFAULT_SORT_MODEL);

  const ordering = useMemo(() => {
    const activeSort = sortModel[0];

    if (!activeSort?.field || !activeSort.sort) {
      return '-captured_at';
    }

    return `${activeSort.sort === 'desc' ? '-' : ''}${activeSort.field}`;
  }, [sortModel]);

  const inspectionsQuery = useQuery({
    queryKey: [
      ...INSPECTIONS_WORKSPACE_QUERY_KEY,
      paginationModel.page,
      paginationModel.pageSize,
      ordering,
    ],
    queryFn: () => fetchInspectionsPage({
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
      ordering,
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

  const selectedInspection = useMemo(
    () => inspections.find((inspection) => inspection.id === selectedInspectionSnapshot?.id) ?? selectedInspectionSnapshot,
    [inspections, selectedInspectionSnapshot],
  );
  const visibleSelectedInspectionId = useMemo(
    () => (
      selectedInspectionSnapshot && inspections.some((inspection) => inspection.id === selectedInspectionSnapshot.id)
        ? selectedInspectionSnapshot.id
        : null
    ),
    [inspections, selectedInspectionSnapshot],
  );

  const handleSelectInspection = (inspection) => {
    setSelectedInspectionSnapshot(inspection ?? null);
  };

  const handleSortModelChange = (nextSortModel) => {
    const nextSort = nextSortModel[0];

    if (!nextSort?.field || !nextSort.sort) {
      setSortModel(DEFAULT_SORT_MODEL);
      return;
    }

    setSortModel([nextSort]);
  };

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

  if (totalInspections === 0) {
    return (
      <StateBlock
        title="No inspections found"
        message="The inspections API returned no records yet."
        minHeight={280}
      />
    );
  }

  return (
    <Stack spacing={1.75}>
      <PageHeader
        eyebrow="Operations"
        title="Inspections"
        subtitle="Browse inspection records from the inspections API and inspect the operational details of the selected record."
      />

      <Grid container spacing={1.75}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <InspectionsList
            inspections={inspections}
            rowCount={totalInspections}
            selectedInspectionId={visibleSelectedInspectionId}
            onSelectInspection={handleSelectInspection}
            deviceMap={deviceMap}
            diseaseMap={diseaseMap}
            loading={inspectionsQuery.isFetching}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <InspectionDetailPanel
            inspection={selectedInspection}
            deviceMap={deviceMap}
            diseaseMap={diseaseMap}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
