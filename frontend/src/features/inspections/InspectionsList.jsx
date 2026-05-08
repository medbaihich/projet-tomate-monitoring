import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import PanelCard from '@/components/ui/PanelCard';
import StatusChip from '@/components/ui/StatusChip';
import {
  formatInspectionConfidence,
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDiseaseLabel,
} from '@/features/inspections/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function InspectionsList({
  inspections,
  rowCount,
  selectedInspectionId,
  onSelectInspection,
  deviceMap,
  diseaseMap,
  loading = false,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
}) {
  const columns = useMemo(
    () => [
      {
        field: 'captured_at',
        headerName: 'Captured',
        minWidth: 180,
        flex: 1,
        sortable: true,
        renderCell: (params) => (
          <Typography variant="body2" color="text.secondary" noWrap sx={{ width: '100%' }}>
            {formatInspectionDateTime(params.value)}
          </Typography>
        ),
      },
      {
        field: 'device',
        headerName: 'Device',
        minWidth: 220,
        flex: 1.25,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap sx={{ width: '100%' }}>
            {resolveInspectionDeviceLabel(params.value, deviceMap)}
          </Typography>
        ),
      },
      {
        field: 'prediction',
        headerName: 'Prediction',
        minWidth: 220,
        flex: 1.2,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap sx={{ width: '100%' }}>
            {params.row.top1_label || resolveInspectionDiseaseLabel(params.row.predicted_disease, diseaseMap)}
          </Typography>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 120,
        flex: 0.7,
        sortable: false,
        renderCell: (params) => (
          <StatusChip
            label={params.value}
            tone={params.value === 'new' ? 'new' : params.value === 'reviewed' ? 'reviewed' : 'neutral'}
          />
        ),
      },
      {
        field: 'processing_status',
        headerName: 'Processing',
        minWidth: 130,
        flex: 0.8,
        sortable: false,
        renderCell: (params) => (
          <StatusChip
            label={params.value}
            tone={params.value === 'failed' ? 'failed' : params.value === 'completed' ? 'completed' : params.value === 'processing' ? 'processing' : 'pending'}
          />
        ),
      },
      {
        field: 'confidence_score',
        headerName: 'Confidence',
        minWidth: 120,
        flex: 0.65,
        align: 'right',
        headerAlign: 'right',
        sortable: true,
        renderCell: (params) => (
          <Typography variant="body2" color="text.secondary" sx={{ width: '100%', textAlign: 'right' }}>
            {formatInspectionConfidence(params.value)}
          </Typography>
        ),
      },
    ],
    [deviceMap, diseaseMap],
  );

  const totalInspections = typeof rowCount === 'number' ? rowCount : inspections.length;
  const rowSelectionModel = useMemo(
    () => (
      selectedInspectionId
        ? { type: 'include', ids: new Set([selectedInspectionId]) }
        : { type: 'include', ids: new Set() }
    ),
    [selectedInspectionId],
  );

  const handleRowSelectionModelChange = (nextSelectionModel) => {
    const nextSelectedId = nextSelectionModel.ids.values().next().value;
    const inspection = inspections.find((row) => row.id === nextSelectedId) ?? null;
    onSelectInspection(inspection);
  };

  return (
    <PanelCard
      title="Inspection registry"
      subtitle="All inspection records returned by the inspections API."
      badge={`${totalInspections} inspection${totalInspections === 1 ? '' : 's'}`}
    >
      <Box sx={{ height: 460 }}>
        <DataGrid
          rows={inspections}
          columns={columns}
          getRowId={(row) => row.id}
          loading={loading}
          pagination
          paginationMode="server"
          sortingMode="server"
          rowCount={totalInspections}
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          sortModel={sortModel}
          onSortModelChange={onSortModelChange}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          disableColumnMenu
          disableRowSelectionOnClick={false}
          onRowSelectionModelChange={handleRowSelectionModelChange}
          rowSelectionModel={rowSelectionModel}
          slots={{
            noRowsOverlay: () => (
              <Stack sx={{ height: '100%' }} alignItems="center" justifyContent="center" spacing={1.5}>
                <Typography variant="subtitle1">No inspections found</Typography>
                <Typography variant="body2" color="text.secondary">
                  The inspections API returned no records.
                </Typography>
              </Stack>
            ),
          }}
          sx={{
            border: 0,
            '& .MuiDataGrid-columnHeader': {
              minHeight: '38px !important',
              maxHeight: '38px !important',
            },
            '& .MuiDataGrid-cell': {
              py: 0.35,
            },
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
              minHeight: '40px !important',
              maxHeight: '40px !important',
            },
          }}
        />
      </Box>
    </PanelCard>
  );
}
