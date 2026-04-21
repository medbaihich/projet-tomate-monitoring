import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import CreateDiseaseDialog from '@/features/catalog/CreateDiseaseDialog';
import DiseaseDetailPanel from '@/features/catalog/DiseaseDetailPanel';
import { createDisease, fetchDiseasesPage } from '@/features/catalog/api';
import useAuthStore from '@/store/authStore';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function CatalogPage() {
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogSession, setCreateDialogSession] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const roleName = useAuthStore((state) => state.user?.role?.name || '');
  const isAdmin = roleName.trim().toLowerCase() === 'admin';

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['catalog-diseases', paginationModel.page, paginationModel.pageSize],
    queryFn: () => fetchDiseasesPage(paginationModel),
    placeholderData: (previousData) => previousData,
  });

  const rows = data?.results ?? [];
  const rowCount = data?.count ?? 0;
  const rowSelectionModel = selectedDisease
    ? { type: 'include', ids: new Set([selectedDisease.id]) }
    : { type: 'include', ids: new Set() };

  const columns = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1.1, minWidth: 180 },
      { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 160 },
      {
        field: 'summary',
        headerName: 'Summary',
        flex: 1.8,
        minWidth: 260,
        renderCell: (params) => (
          <Typography variant="body2" color="text.secondary" noWrap sx={{ width: '100%' }}>
            {params.value || 'N/A'}
          </Typography>
        ),
      },
      {
        field: 'created_at',
        headerName: 'Created',
        minWidth: 190,
        flex: 0.9,
      },
      {
        field: 'updated_at',
        headerName: 'Updated',
        minWidth: 190,
        flex: 0.9,
      },
    ],
    [],
  );

  const handlePaginationModelChange = (nextModel) => {
    setPaginationModel(nextModel);
    setSelectedDisease(null);
  };

  const handleRowSelectionModelChange = (rowSelectionModel) => {
    const selectedId = rowSelectionModel.ids.values().next().value;
    const disease = rows.find((row) => row.id === selectedId) ?? null;
    setSelectedDisease(disease);
  };

  const createDiseaseMutation = useMutation({
    mutationFn: createDisease,
  });

  const handleCreateDisease = async (payload) => {
    const createdDisease = await createDiseaseMutation.mutateAsync(payload);
    setSelectedDisease(createdDisease);
    setIsCreateDialogOpen(false);
    setSuccessMessage(`Disease "${createdDisease.name}" created successfully.`);
    await refetch();
    return createdDisease;
  };

  return (
    <>
      <Stack spacing={1.75}>
        <PageHeader
          eyebrow="Knowledge Base"
          title="Catalog"
          subtitle="Real paginated disease catalog from the backend, including nested causes, treatments, and resources."
          actions={isAdmin ? (
            <Button
              variant="contained"
              onClick={() => {
                setCreateDialogSession((currentValue) => currentValue + 1);
                setIsCreateDialogOpen(true);
              }}
            >
              Add disease
            </Button>
          ) : null}
        />

        {isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Retry
              </Button>
            }
          >
            {error?.response?.data?.detail || error?.message || 'Failed to load the disease catalog.'}
          </Alert>
        ) : null}

        <Grid container spacing={1.75}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <PanelCard
              title="Disease registry"
              subtitle="Paginated backend records with server-side paging."
            >
              <Box sx={{ height: 420 }}>
                <DataGrid
                  rows={rows}
                  columns={columns}
                  getRowId={(row) => row.id}
                  loading={isLoading || isFetching}
                  pagination
                  paginationMode="server"
                  paginationModel={paginationModel}
                  onPaginationModelChange={handlePaginationModelChange}
                  rowCount={rowCount}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  disableColumnMenu
                  disableRowSelectionOnClick={false}
                  onRowSelectionModelChange={handleRowSelectionModelChange}
                  rowSelectionModel={rowSelectionModel}
                  slots={{
                    noRowsOverlay: () => (
                      <Stack sx={{ height: '100%' }} alignItems="center" justifyContent="center" spacing={1.5}>
                        <Typography variant="subtitle1">No diseases found</Typography>
                        <Typography variant="body2" color="text.secondary">
                          The backend returned an empty paginated catalog.
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
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <DiseaseDetailPanel disease={selectedDisease} />
          </Grid>
        </Grid>
      </Stack>

      <CreateDiseaseDialog
        key={createDialogSession}
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateDisease}
        isSubmitting={createDiseaseMutation.isPending}
      />

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </>
  );
}
