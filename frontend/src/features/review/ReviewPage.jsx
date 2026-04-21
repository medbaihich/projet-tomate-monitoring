import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import PageHeader from '@/components/ui/PageHeader';
import ReviewWorkspaceList from '@/features/review/ReviewWorkspaceList';
import ReviewDetailPanel from '@/features/review/ReviewDetailPanel';
import { fetchReviewWorkspace, submitReview } from '@/features/review/api';
import { isInspectionReviewable } from '@/features/review/utils';

function buildMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [activeView, setActiveView] = useState('pending');
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const [selectedHistoryReviewId, setSelectedHistoryReviewId] = useState(null);
  const [lastSubmittedInspectionId, setLastSubmittedInspectionId] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const appliedFocusKeyRef = useRef(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['review-workspace'],
    queryFn: fetchReviewWorkspace,
  });

  const inspections = useMemo(() => data?.inspections ?? [], [data?.inspections]);
  const reviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);
  const devices = useMemo(() => data?.devices ?? [], [data?.devices]);
  const diseases = useMemo(() => data?.diseases ?? [], [data?.diseases]);

  const reviewedInspectionIds = useMemo(
    () => new Set(reviews.map((review) => review.inspection)),
    [reviews],
  );

  const reviewableInspections = useMemo(
    () => inspections.filter((inspection) => isInspectionReviewable(inspection, reviewedInspectionIds)),
    [inspections, reviewedInspectionIds],
  );

  const inspectionMap = useMemo(() => buildMap(inspections), [inspections]);
  const deviceMap = useMemo(() => buildMap(devices), [devices]);
  const diseaseMap = useMemo(() => buildMap(diseases), [diseases]);
  const reviewHistoryItems = useMemo(
    () => [...reviews]
      .sort((left, right) => {
        const rightValue = right.reviewed_at || right.created_at || '';
        const leftValue = left.reviewed_at || left.created_at || '';
        return rightValue.localeCompare(leftValue);
      })
      .map((review) => ({
        review,
        inspection: inspectionMap.get(review.inspection) ?? null,
      })),
    [inspectionMap, reviews],
  );

  const selectedInspection = useMemo(
    () => reviewableInspections.find((inspection) => inspection.id === selectedInspectionId) ?? null,
    [reviewableInspections, selectedInspectionId],
  );
  const lastSubmittedInspection = useMemo(
    () => inspections.find((inspection) => inspection.id === lastSubmittedInspectionId) ?? null,
    [inspections, lastSubmittedInspectionId],
  );
  const panelInspection = selectedInspection ?? lastSubmittedInspection;
  const isSubmittedInspectionVisible = Boolean(
    panelInspection
    && lastSubmittedInspectionId
    && panelInspection.id === lastSubmittedInspectionId
    && !selectedInspection,
  );
  const activeHistoryReviewId = useMemo(() => {
    if (selectedHistoryReviewId && reviewHistoryItems.some((item) => item.review.id === selectedHistoryReviewId)) {
      return selectedHistoryReviewId;
    }

    return reviewHistoryItems[0]?.review.id ?? null;
  }, [reviewHistoryItems, selectedHistoryReviewId]);
  const selectedHistoryItem = useMemo(
    () => reviewHistoryItems.find((item) => item.review.id === activeHistoryReviewId) ?? null,
    [activeHistoryReviewId, reviewHistoryItems],
  );
  const requestedFocusInspectionId = location.state?.focusInspectionId ?? null;

  useEffect(() => {
    if (!requestedFocusInspectionId || isLoading) {
      return;
    }

    const focusKey = `${location.key}:${requestedFocusInspectionId}`;
    if (appliedFocusKeyRef.current === focusKey) {
      return;
    }

    appliedFocusKeyRef.current = focusKey;
    setActiveView('pending');
    setLastSubmittedInspectionId(null);

    const focusedInspection = reviewableInspections.find(
      (inspection) => inspection.id === requestedFocusInspectionId,
    );

    setSelectedInspectionId(focusedInspection?.id ?? null);
  }, [isLoading, location.key, requestedFocusInspectionId, reviewableInspections]);

  const submitMutation = useMutation({
    mutationFn: submitReview,
    onSuccess: async (data, variables) => {
      setSuccessOpen(true);
      setLastSubmittedInspectionId(variables.inspection);
      setSelectedHistoryReviewId(data.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['review-workspace'] }),
        queryClient.invalidateQueries({ queryKey: ['inspections-workspace'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-operations'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog-diseases'] }),
      ]);
    },
  });

  const handleSelectInspection = (inspection) => {
    setSelectedInspectionId(inspection.id);
    setLastSubmittedInspectionId(null);
  };
  const handleSelectHistoryItem = (item) => {
    setSelectedHistoryReviewId(item.review.id);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading review workspace...</Typography>
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
        {error?.response?.data?.detail || error?.message || 'Failed to load the review workspace.'}
      </Alert>
    );
  }

  return (
    <>
      <Stack spacing={1.75}>
        <PageHeader
          eyebrow="Quality Control"
          title="Review"
          subtitle="Review low-confidence inspection predictions and revisit previously submitted review decisions."
        />

        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={activeView}
            onChange={(_event, nextValue) => setActiveView(nextValue)}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            <Tab label={`Pending (${reviewableInspections.length})`} value="pending" />
            <Tab label={`Reviewed History (${reviewHistoryItems.length})`} value="history" />
          </Tabs>
        </Box>

        <Grid container spacing={1.75}>
          <Grid size={{ xs: 12, lg: 5 }}>
            {activeView === 'pending' ? (
              <ReviewWorkspaceList
                mode="pending"
                items={reviewableInspections}
                selectedItemId={selectedInspectionId}
                onSelectItem={handleSelectInspection}
                diseaseMap={diseaseMap}
                deviceMap={deviceMap}
                emptyTitle="No low-confidence inspections waiting for review"
                emptyMessage="All currently fetched low-confidence inspections are already reviewed, or no inspections currently meet the confidence <= 0.5 review rule."
              />
            ) : (
              <ReviewWorkspaceList
                mode="history"
                items={reviewHistoryItems}
                selectedItemId={activeHistoryReviewId}
                onSelectItem={handleSelectHistoryItem}
                diseaseMap={diseaseMap}
                deviceMap={deviceMap}
                emptyTitle="No reviewed history yet"
                emptyMessage="No review records have been returned by the backend yet."
              />
            )}
          </Grid>

          <Grid size={{ xs: 12, lg: 7 }}>
            {activeView === 'pending' ? (
              <ReviewDetailPanel
                key={`pending-${panelInspection?.id ?? 'empty-review-panel'}`}
                mode="pending"
                inspection={panelInspection}
                diseaseMap={diseaseMap}
                deviceMap={deviceMap}
                diseases={diseases}
                submitMutation={submitMutation}
                submitError={submitMutation.error}
                isSubmittedState={isSubmittedInspectionVisible}
              />
            ) : (
              <ReviewDetailPanel
                key={`history-${selectedHistoryItem?.review.id ?? 'empty-history-panel'}`}
                mode="history"
                inspection={selectedHistoryItem?.inspection ?? null}
                review={selectedHistoryItem?.review ?? null}
                diseaseMap={diseaseMap}
                deviceMap={deviceMap}
                diseases={diseases}
                submitMutation={submitMutation}
                submitError={null}
                isSubmittedState={false}
              />
            )}
          </Grid>
        </Grid>
      </Stack>

      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        message="Review submitted successfully."
      />
    </>
  );
}
