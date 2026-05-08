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
import {
  fetchInspectionReferenceData,
  INSPECTION_REFERENCE_DATA_QUERY_KEY,
  INSPECTIONS_WORKSPACE_QUERY_KEY,
} from '@/features/inspections/api';
import ReviewWorkspaceList from '@/features/review/ReviewWorkspaceList';
import ReviewDetailPanel from '@/features/review/ReviewDetailPanel';
import { fetchReviewWorkspace, REVIEW_WORKSPACE_QUERY_KEY, submitReview } from '@/features/review/api';
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

  const workspaceQuery = useQuery({
    queryKey: REVIEW_WORKSPACE_QUERY_KEY,
    queryFn: fetchReviewWorkspace,
    placeholderData: (previousData) => previousData,
  });

  const referenceQuery = useQuery({
    queryKey: INSPECTION_REFERENCE_DATA_QUERY_KEY,
    queryFn: fetchInspectionReferenceData,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const inspections = useMemo(
    () => workspaceQuery.data?.inspections ?? [],
    [workspaceQuery.data?.inspections],
  );
  const reviews = useMemo(() => workspaceQuery.data?.reviews ?? [], [workspaceQuery.data?.reviews]);
  const devices = useMemo(() => referenceQuery.data?.devices ?? [], [referenceQuery.data?.devices]);
  const diseases = useMemo(() => referenceQuery.data?.diseases ?? [], [referenceQuery.data?.diseases]);

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

  useEffect(() => {
    if (!requestedFocusInspectionId || workspaceQuery.isLoading) {
      return undefined;
    }

    const focusKey = `${location.key}:${requestedFocusInspectionId}`;
    if (appliedFocusKeyRef.current === focusKey) {
      return undefined;
    }

    appliedFocusKeyRef.current = focusKey;
    const focusedInspectionId = reviewableInspections.find(
      (inspection) => inspection.id === requestedFocusInspectionId,
    )?.id ?? null;

    let isCancelled = false;
    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      setActiveView('pending');
      setLastSubmittedInspectionId(null);
      setSelectedInspectionId(focusedInspectionId);
    });

    return () => {
      isCancelled = true;
    };
  }, [location.key, requestedFocusInspectionId, reviewableInspections, workspaceQuery.isLoading]);

  const submitMutation = useMutation({
    mutationFn: submitReview,
    onSuccess: async (data, variables) => {
      setSuccessOpen(true);
      setLastSubmittedInspectionId(variables.inspection);
      setSelectedHistoryReviewId(data.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REVIEW_WORKSPACE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: INSPECTIONS_WORKSPACE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-operations'] }),
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

  if (workspaceQuery.isLoading || referenceQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading review workspace...</Typography>
        </Stack>
      </Box>
    );
  }

  if (workspaceQuery.isError || referenceQuery.isError) {
    const activeError = workspaceQuery.error || referenceQuery.error;

    return (
      <Alert
        severity="error"
        action={(
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              workspaceQuery.refetch();
              referenceQuery.refetch();
            }}
          >
            Retry
          </Button>
        )}
      >
        {activeError?.response?.data?.detail || activeError?.message || 'Failed to load the review workspace.'}
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
