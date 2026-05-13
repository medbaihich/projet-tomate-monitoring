import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  Snackbar,
  Stack,
} from '@mui/material';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import CatalogDiseaseDetailDrawer from '@/features/catalog/CatalogDiseaseDetailDrawer';
import CatalogDiseaseSpreadMap from '@/features/catalog/CatalogDiseaseSpreadMap';
import CreateDiseaseDialog from '@/features/catalog/CreateDiseaseDialog';
import CatalogDiseasesTable from '@/features/catalog/components/CatalogDiseasesTable';
import {
  CATALOG_DISEASES_QUERY_KEY,
  CATALOG_PROFILE_BOARD_QUERY_KEY,
  createDisease,
  fetchCatalogDiseaseProfileBoard,
  fetchDiseasesPage,
} from '@/features/catalog/api';
import useAuthStore from '@/store/authStore';

export default function CatalogPage() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [sorting, setSorting] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogSession, setCreateDialogSession] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [organTypeFilter, setOrganTypeFilter] = useState('');
  const queryClient = useQueryClient();
  const roleName = useAuthStore((state) => state.user?.role?.name || '');
  const isAdmin = roleName.trim().toLowerCase() === 'admin';

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      ...CATALOG_DISEASES_QUERY_KEY,
      pagination.pageIndex,
      pagination.pageSize,
      organTypeFilter,
      sorting,
    ],
    queryFn: () => fetchDiseasesPage({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      organType: organTypeFilter,
      sorting,
    }),
    placeholderData: (previousData) => previousData,
  });

  const {
    data: spreadMapDiseases = [],
    isLoading: isSpreadMapLoading,
    isError: isSpreadMapError,
  } = useQuery({
    queryKey: CATALOG_PROFILE_BOARD_QUERY_KEY,
    queryFn: fetchCatalogDiseaseProfileBoard,
  });

  const rows = data?.results ?? [];
  const rowCount = data?.count ?? 0;
  const filteredSpreadMapDiseases = useMemo(
    () => (organTypeFilter
      ? spreadMapDiseases.filter((disease) => disease.organ_type === organTypeFilter)
      : spreadMapDiseases),
    [organTypeFilter, spreadMapDiseases],
  );

  const handleSelectDisease = useCallback((disease) => {
    setSelectedDisease(disease ?? null);
  }, []);
  const handleCloseDiseaseDetails = useCallback(() => {
    setSelectedDisease(null);
  }, []);
  const handlePaginationChange = useCallback((updater) => {
    setPagination((currentValue) => (typeof updater === 'function' ? updater(currentValue) : updater));
  }, []);
  const handleSortingChange = useCallback((updater) => {
    setSorting((currentValue) => (typeof updater === 'function' ? updater(currentValue) : updater));
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
    setSelectedDisease(null);
  }, []);
  const handleOrganTypeFilterChange = useCallback((nextOrganType) => {
    setOrganTypeFilter(nextOrganType);
    setPagination((currentValue) => ({ ...currentValue, pageIndex: 0 }));
    setSelectedDisease(null);
  }, []);

  const createDiseaseMutation = useMutation({
    mutationFn: createDisease,
  });

  const handleCreateDisease = async (payload) => {
    const createdDisease = await createDiseaseMutation.mutateAsync(payload);
    setSelectedDisease(createdDisease);
    setIsCreateDialogOpen(false);
    setSuccessMessage(`Disease "${createdDisease.name}" created successfully.`);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: CATALOG_PROFILE_BOARD_QUERY_KEY }),
    ]);
    return createdDisease;
  };

  return (
    <>
      <Stack spacing={1.75}>
        <PageHeader
          title="Catalog"
          actions={isAdmin ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={() => {
                setCreateDialogSession((currentValue) => currentValue + 1);
                setIsCreateDialogOpen(true);
              }}
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

        <PanelCard
          title="Disease registry"
          subtitle="Compact catalog table backed by the paginated diseases API."
          badge={`${rowCount} disease${rowCount === 1 ? '' : 's'}`}
        >
          <CatalogDiseasesTable
            diseases={rows}
            totalCount={rowCount}
            isLoading={isLoading}
            isFetching={isFetching}
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            sorting={sorting}
            organTypeFilter={organTypeFilter}
            selectedDiseaseId={selectedDisease?.id || ''}
            onPaginationChange={handlePaginationChange}
            onSortingChange={handleSortingChange}
            onOrganTypeFilterChange={handleOrganTypeFilterChange}
            onSelectDisease={handleSelectDisease}
            onRefresh={() => refetch()}
          />
        </PanelCard>

        <CatalogDiseaseSpreadMap
          diseases={filteredSpreadMapDiseases}
          isLoading={isSpreadMapLoading}
          isError={isSpreadMapError}
          onSelectDisease={handleSelectDisease}
        />
      </Stack>

      <CatalogDiseaseDetailDrawer
        open={Boolean(selectedDisease)}
        disease={selectedDisease}
        onClose={handleCloseDiseaseDetails}
      />

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
