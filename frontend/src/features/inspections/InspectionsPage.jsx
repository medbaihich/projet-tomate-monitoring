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
import { fetchInspectionsWorkspace } from '@/features/inspections/api';
import InspectionDetailPanel from '@/features/inspections/InspectionDetailPanel';
import InspectionsList from '@/features/inspections/InspectionsList';

function buildMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

export default function InspectionsPage() {
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inspections-workspace'],
    queryFn: fetchInspectionsWorkspace,
  });

  const inspections = useMemo(() => data?.inspections ?? [], [data?.inspections]);
  const devices = useMemo(() => data?.devices ?? [], [data?.devices]);
  const diseases = useMemo(() => data?.diseases ?? [], [data?.diseases]);
  const deviceMap = useMemo(() => buildMap(devices), [devices]);
  const diseaseMap = useMemo(() => buildMap(diseases), [diseases]);

  const selectedInspection = useMemo(
    () => inspections.find((inspection) => inspection.id === selectedInspectionId) ?? null,
    [inspections, selectedInspectionId],
  );

  const handleSelectInspection = (inspection) => {
    setSelectedInspectionId(inspection?.id ?? null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading inspections...</Typography>
        </Stack>
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={(
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        )}
      >
        {error?.response?.data?.detail || error?.message || 'Failed to load inspections.'}
      </Alert>
    );
  }

  if (inspections.length === 0) {
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
            selectedInspectionId={selectedInspectionId}
            onSelectInspection={handleSelectInspection}
            deviceMap={deviceMap}
            diseaseMap={diseaseMap}
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
