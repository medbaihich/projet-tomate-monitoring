import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { fetchDashboardData, fetchDashboardReferenceData } from '@/features/dashboard/api';
import DashboardMetricCard from '@/features/dashboard/DashboardMetricCard';
import DashboardChartCard from '@/features/dashboard/DashboardChartCard';
import {
  ActivityLineChart,
  DistributionBars,
  DonutBreakdown,
} from '@/features/dashboard/DashboardCharts';
import {
  QuickActionsPanel,
  RecentInspectionsTable,
} from '@/features/dashboard/DashboardOperationsPanels';
import { formatConfidencePercentage } from '@/features/dashboard/utils';
import {
  fetchNotificationsPage,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_PAGE_SIZE,
} from '@/features/notifications/api';
import NotificationDashboardPanel from '@/features/notifications/NotificationDashboardPanel';
import NotificationDetailDrawer from '@/features/notifications/NotificationDetailDrawer';
import useAuthStore from '@/store/authStore';
import { resolveInspectionDiseaseLabel } from '@/features/inspections/utils';

const NOTIFICATIONS_QUERY_KEY = ['dashboard-notifications'];
const UNREAD_COUNT_QUERY_KEY = ['dashboard-notifications-unread-count'];
const DASHBOARD_REFERENCE_QUERY_KEY = ['dashboard-reference-data'];
const DASHBOARD_REFRESH_DEBOUNCE_MS = 15000;

function DashboardSkeleton() {
  return (
    <Stack spacing={1.5}>
      <Stack spacing={1}>
        <Skeleton width={200} height={34} />
        <Skeleton width={420} />
      </Stack>

      <Skeleton variant="rounded" height={200} />

      <Grid container spacing={1.5}>
        {[1, 2, 3, 4].map((item) => (
          <Grid key={item} size={{ xs: 12, sm: 6, xl: 3 }}>
            <Skeleton variant="rounded" height={96} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Skeleton variant="rounded" height={228} />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <Skeleton variant="rounded" height={228} />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Skeleton variant="rounded" height={228} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Skeleton variant="rounded" height={228} />
        </Grid>
      </Grid>
    </Stack>
  );
}

function buildNotificationsWebSocketUrl(accessToken) {
  if (!accessToken || typeof window === 'undefined') {
    return null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/notifications/?token=${encodeURIComponent(accessToken)}`;
}

function mergeNotificationPage(previousData, incomingNotification) {
  const currentResults = previousData?.results ?? [];
  const alreadyKnown = currentResults.some((notification) => notification.id === incomingNotification.id);
  const nextResults = [
    incomingNotification,
    ...currentResults.filter((notification) => notification.id !== incomingNotification.id),
  ].slice(0, Math.max(currentResults.length, NOTIFICATIONS_PAGE_SIZE));

  return {
    count: alreadyKnown ? (previousData?.count ?? nextResults.length) : (previousData?.count ?? currentResults.length) + 1,
    next: previousData?.next ?? null,
    previous: previousData?.previous ?? null,
    results: nextResults,
  };
}

function updateNotificationInPage(previousData, updatedNotification) {
  if (!previousData?.results?.length) {
    return previousData;
  }

  return {
    ...previousData,
    results: previousData.results.map((notification) => (
      notification.id === updatedNotification.id ? updatedNotification : notification
    )),
  };
}

function markAllNotificationsAsReadInPage(previousData) {
  if (!previousData?.results?.length) {
    return previousData;
  }

  const markedAt = new Date().toISOString();

  return {
    ...previousData,
    results: previousData.results.map((notification) => (
      notification.is_read
        ? notification
        : { ...notification, is_read: true, read_at: markedAt }
    )),
  };
}

function normalizeLabel(value) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function formatDiseaseLabel(value) {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return 'No active alerts';
  }

  return normalized
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatAlertTimestamp(value) {
  if (!value) {
    return 'Waiting for next disease alert';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Waiting for next disease alert';
  }

  return date.toLocaleString();
}

function resolveLatestAlertDeviceLabel(notification) {
  const deviceName = notification?.payload?.device_name?.trim();
  const deviceIdentifier = notification?.payload?.device_identifier?.trim();

  if (deviceName && deviceIdentifier && deviceIdentifier !== deviceName) {
    return `${deviceName} (${deviceIdentifier})`;
  }

  if (deviceName) {
    return deviceName;
  }

  if (deviceIdentifier) {
    return deviceIdentifier;
  }

  return 'Device unavailable';
}

function resolveDiseaseRecord(notification, diseases) {
  if (!notification) {
    return null;
  }

  if (notification.disease) {
    return diseases.find((disease) => disease.id === notification.disease) ?? null;
  }

  const normalizedLabel = normalizeLabel(notification.display_disease_label);
  return diseases.find((disease) => normalizeLabel(disease.name) === normalizedLabel) ?? null;
}

function resolveInspectionTimestamp(inspection) {
  return inspection?.captured_at || inspection?.received_at || inspection?.processed_at || '';
}

function buildRelatedInspections(inspections, notification, disease, diseaseMap) {
  if (!notification) {
    return [];
  }

  const normalizedLabel = normalizeLabel(notification.display_disease_label || disease?.name);

  return inspections
    .filter((inspection) => {
      if (inspection.id === notification.inspection) {
        return false;
      }

      const matchesDiseaseId = disease ? inspection.predicted_disease === disease.id : false;
      const resolvedLabel = normalizeLabel(
        inspection.top1_label || resolveInspectionDiseaseLabel(inspection.predicted_disease, diseaseMap, ''),
      );

      return matchesDiseaseId || (normalizedLabel && resolvedLabel === normalizedLabel);
    })
    .sort((left, right) => resolveInspectionTimestamp(right).localeCompare(resolveInspectionTimestamp(left)))
    .slice(0, 5);
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [liveAlert, setLiveAlert] = useState(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-operations'],
    queryFn: fetchDashboardData,
    placeholderData: (previousData) => previousData,
  });

  const dashboardReferenceQuery = useQuery({
    queryKey: DASHBOARD_REFERENCE_QUERY_KEY,
    queryFn: fetchDashboardReferenceData,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchNotificationsPage({ pageSize: NOTIFICATIONS_PAGE_SIZE }),
    placeholderData: (previousData) => previousData,
    refetchInterval: 2 * 60 * 1000,
  });

  const unreadCountQuery = useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadNotificationsCount,
    placeholderData: (previousData) => previousData ?? 0,
    refetchInterval: 2 * 60 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (updatedNotification) => {
      const previousPage = queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY);
      const wasUnread = (previousPage?.results ?? []).some(
        (notification) => notification.id === updatedNotification.id && !notification.is_read,
      );

      queryClient.setQueryData(
        NOTIFICATIONS_QUERY_KEY,
        (previousData) => updateNotificationInPage(previousData, updatedNotification),
      );

      if (wasUnread) {
        queryClient.setQueryData(
          UNREAD_COUNT_QUERY_KEY,
          (previousCount) => (typeof previousCount === 'number' ? Math.max(previousCount - 1, 0) : previousCount),
        );
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData(
        NOTIFICATIONS_QUERY_KEY,
        (previousData) => markAllNotificationsAsReadInPage(previousData),
      );
      queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, 0);
    },
  });

  useEffect(() => {
    const websocketUrl = buildNotificationsWebSocketUrl(accessToken);
    if (!websocketUrl) {
      return undefined;
    }

    let socket;
    let reconnectTimeoutId;
    let dashboardRefreshTimeoutId;
    let reconnectAttempts = 0;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) {
        return;
      }

      socket = new WebSocket(websocketUrl);

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== 'notification.created' || !payload.notification) {
            return;
          }

          const existingPage = queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY);
          const alreadyKnown = (existingPage?.results ?? []).some(
            (notification) => notification.id === payload.notification.id,
          );

          queryClient.setQueryData(
            NOTIFICATIONS_QUERY_KEY,
            (previousData) => mergeNotificationPage(previousData, payload.notification),
          );

          if (!alreadyKnown) {
            queryClient.setQueryData(
              UNREAD_COUNT_QUERY_KEY,
              (previousCount) => (typeof previousCount === 'number' ? previousCount + 1 : previousCount),
            );
            setLiveAlert(payload.notification);
          }

          // Coalesce live events so bursts of notifications do not immediately retrigger
          // the full dashboard query on every socket message.
          if (!dashboardRefreshTimeoutId) {
            dashboardRefreshTimeoutId = window.setTimeout(() => {
              dashboardRefreshTimeoutId = null;
              queryClient.invalidateQueries({ queryKey: ['dashboard-operations'] });
            }, DASHBOARD_REFRESH_DEBOUNCE_MS);
          }
        } catch {
          // Ignore malformed websocket payloads and fall back to REST refreshes.
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (isDisposed) {
          return;
        }

        reconnectAttempts += 1;
        reconnectTimeoutId = window.setTimeout(
          connect,
          Math.min(1000 * (2 ** reconnectAttempts), 15000),
        );
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutId) {
        window.clearTimeout(reconnectTimeoutId);
      }
      if (dashboardRefreshTimeoutId) {
        window.clearTimeout(dashboardRefreshTimeoutId);
      }

      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [accessToken, queryClient]);

  const notifications = useMemo(
    () => notificationsQuery.data?.results ?? [],
    [notificationsQuery.data?.results],
  );
  const unreadCount = typeof unreadCountQuery.data === 'number'
    ? unreadCountQuery.data
    : notifications.filter((notification) => !notification.is_read).length;
  const latestNotification = notifications[0] ?? null;
  const latestAlertDiseaseLabel = formatDiseaseLabel(
    latestNotification?.display_disease_label || latestNotification?.title,
  );
  const latestAlertReadStateLabel = latestNotification
    ? latestNotification.is_read
      ? 'Read'
      : 'Unread'
    : 'No Alert';
  const latestAlertConfidenceLabel = latestNotification
    ? `Confidence ${formatConfidencePercentage(latestNotification.confidence_score)}`
    : 'No current disease alert';
  const latestAlertDeviceLabel = resolveLatestAlertDeviceLabel(latestNotification);
  const latestAlertTimestampLabel = formatAlertTimestamp(latestNotification?.created_at);

  const deviceMap = useMemo(
    () => new Map((dashboardReferenceQuery.data?.devices ?? []).map((device) => [device.id, device])),
    [dashboardReferenceQuery.data?.devices],
  );
  const diseaseMap = useMemo(
    () => new Map((dashboardReferenceQuery.data?.diseases ?? []).map((disease) => [disease.id, disease])),
    [dashboardReferenceQuery.data?.diseases],
  );
  const reviewActionItems = useMemo(
    () => (data?.pendingReviewQueue ?? []).map((inspection) => ({
      ...inspection,
      device_label: deviceMap.get(inspection.device)
        ? `${deviceMap.get(inspection.device).name} (${deviceMap.get(inspection.device).identifier})`
        : 'Unknown device',
    })),
    [data?.pendingReviewQueue, deviceMap],
  );

  const selectedNotification = useMemo(
    () => notifications.find((notification) => notification.id === selectedNotificationId) ?? null,
    [notifications, selectedNotificationId],
  );

  const selectedInspection = useMemo(
    () => (data?.allInspections ?? []).find((inspection) => inspection.id === selectedNotification?.inspection) ?? null,
    [data?.allInspections, selectedNotification],
  );

  const selectedDisease = useMemo(
    () => resolveDiseaseRecord(selectedNotification, dashboardReferenceQuery.data?.diseases ?? []),
    [selectedNotification, dashboardReferenceQuery.data?.diseases],
  );

  const relatedInspections = useMemo(
    () => buildRelatedInspections(data?.allInspections ?? [], selectedNotification, selectedDisease, diseaseMap),
    [data?.allInspections, selectedDisease, selectedNotification, diseaseMap],
  );

  const handleOpenNotification = (notification) => {
    setSelectedNotificationId(notification.id);
    setIsDetailOpen(true);

    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
  };

  const handleCloseNotification = () => {
    setIsDetailOpen(false);
  };
  const handleOpenReviewItem = (inspection) => {
    navigate('/review', {
      state: {
        focusInspectionId: inspection.id,
      },
    });
  };
  const handleOpenReviewWorkspace = () => {
    navigate('/review');
  };

  if (isLoading || dashboardReferenceQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || dashboardReferenceQuery.isError) {
    const activeError = error || dashboardReferenceQuery.error;

    return (
      <Alert
        severity="error"
        action={(
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              refetch();
              dashboardReferenceQuery.refetch();
            }}
          >
            Retry
          </Button>
        )}
      >
        {activeError?.response?.data?.detail || activeError?.message || 'Failed to load dashboard data.'}
      </Alert>
    );
  }

  const { summary } = data;

  return (
    <>
      <Stack spacing={1.35} sx={{ pb: 0.2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.03em',
              fontSize: 'clamp(1.56rem, 1.26rem + 0.9vw, 2rem)',
              lineHeight: 1.02,
            }}
          >
            Dashboard
          </Typography>
          <Button
            variant="text"
            color="inherit"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => {
              refetch();
              dashboardReferenceQuery.refetch();
              notificationsQuery.refetch();
              unreadCountQuery.refetch();
            }}
            size="small"
          >
            Refresh
          </Button>
        </Stack>

        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <DashboardMetricCard
              title="Total Devices"
              value={summary.deviceCount}
              helper="Active monitoring devices currently configured in the workspace."
              accent="primary"
              chipLabel="Devices"
              trendLabel={summary.deviceCount > 0 ? 'Configured' : 'Unconfigured'}
              footerLabel="Synced from live device inventory"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <DashboardMetricCard
              title="Total Inspections"
              value={summary.inspectionCount}
              helper="Inspection records currently tracked across the workspace."
              accent="info"
              chipLabel="Inspections"
              trendLabel={`${summary.recentInspectionCount} in 7d sample`}
              footerLabel={summary.inspectionFreshnessLabel}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <DashboardMetricCard
              title="Disease Catalog"
              value={summary.diseaseCount}
              helper="Reference diseases available for diagnosis and review."
              accent="secondary"
              chipLabel="Catalog"
              trendLabel={summary.diseaseCount > 0 ? 'Reference ready' : 'No entries'}
              footerLabel="Reference catalog ready for review"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <DashboardMetricCard
              title="Latest Disease Alert"
              value={latestAlertDiseaseLabel}
              helper={latestAlertDeviceLabel}
              accent="alert"
              chipLabel={latestAlertReadStateLabel}
              trendLabel={latestAlertConfidenceLabel}
              footerLabel={latestAlertTimestampLabel}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1.25} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 8 }}>
            <NotificationDashboardPanel
              notifications={notifications}
              unreadCount={unreadCount}
              isLoading={notificationsQuery.isLoading}
              isError={notificationsQuery.isError}
              error={notificationsQuery.error}
              onRetry={() => {
                notificationsQuery.refetch();
                unreadCountQuery.refetch();
              }}
              onOpenNotification={handleOpenNotification}
              onMarkAllRead={() => markAllReadMutation.mutate()}
              isMarkingAllRead={markAllReadMutation.isPending}
              reviewItems={reviewActionItems}
              reviewCount={summary.pendingReviewCount}
              onOpenReviewItem={handleOpenReviewItem}
              onOpenReviewWorkspace={handleOpenReviewWorkspace}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <DashboardChartCard
              title="Quick Actions"
              subtitle="Navigate directly to the operational areas that support this dashboard."
              minHeight={240}
              badgeLabel="Navigate"
            >
              <QuickActionsPanel />
            </DashboardChartCard>
          </Grid>
        </Grid>

        <Grid container spacing={1} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 7 }}>
            <DashboardChartCard
              title="Inspection Activity"
              subtitle="Inspection volume by capture date across all available inspection records."
              badgeLabel="Recent capture window"
              minHeight={194}
              action={(
                <Button component={RouterLink} to="/review" size="small" color="inherit">
                  Open workspace
                </Button>
              )}
            >
              <ActivityLineChart data={summary.inspectionActivity} />
            </DashboardChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <DashboardChartCard
              title="Review Decisions"
              subtitle="Accepted, corrected, and rejected review distribution."
              badgeLabel="Quality control"
              minHeight={194}
            >
              <DonutBreakdown
                data={summary.reviewDecisionBreakdown}
                centerLabel="Reviews"
                centerValue={summary.reviewCount}
              />
            </DashboardChartCard>
          </Grid>
        </Grid>

        <Grid container spacing={1.25} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 4 }}>
            <DashboardChartCard
              title="Inspection Status"
              subtitle="Current operational state of inspection records."
              badgeLabel="Lifecycle"
            >
              <DistributionBars data={summary.inspectionStatusBreakdown} />
            </DashboardChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <DashboardChartCard
              title="Processing Pipeline"
              subtitle="Processing status distribution from the inspections backend."
              badgeLabel="Execution"
            >
              <DistributionBars data={summary.processingStatusBreakdown} />
            </DashboardChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <DashboardChartCard
              title="Organ Type Mix"
              subtitle="Workload distribution between leaf and fruit inspections."
              badgeLabel="Input mix"
            >
              <DonutBreakdown
                data={summary.organTypeBreakdown}
                centerLabel="Organs"
                centerValue={summary.inspectionCount}
              />
            </DashboardChartCard>
          </Grid>
        </Grid>

        <Grid container spacing={1.25} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 8 }}>
            <DashboardChartCard
              title="Recent Inspections"
              subtitle="Newest inspection records with resolved device and prediction context when available."
              minHeight={220}
              badgeLabel="Recent records"
            >
              <RecentInspectionsTable
                inspections={data.recentInspections}
                deviceMap={deviceMap}
                diseaseMap={diseaseMap}
              />
            </DashboardChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <DashboardChartCard
              title="Confidence Distribution"
              subtitle="Confidence pattern across all available inspection records."
              minHeight={220}
              badgeLabel="Model signal"
            >
              <Stack spacing={1}>
                <DashboardMetricCard
                  title="Average Confidence"
                  value={formatConfidencePercentage(summary.averageConfidence)}
                  helper="Calculated from all inspection rows with valid normalized confidence values."
                  accent="success"
                  trendLabel={`${summary.inspectionCount} records`}
                />
                <DistributionBars
                  data={summary.confidenceDistribution}
                  valueFormatter={(value) => `${value} samples`}
                />
              </Stack>
            </DashboardChartCard>
          </Grid>
        </Grid>
      </Stack>

      <NotificationDetailDrawer
        open={isDetailOpen}
        onClose={handleCloseNotification}
        notification={selectedNotification}
        inspection={selectedInspection}
        disease={selectedDisease}
        relatedInspections={relatedInspections}
        deviceMap={deviceMap}
        diseaseMap={diseaseMap}
      />

      <Snackbar
        open={Boolean(liveAlert)}
        autoHideDuration={5000}
        onClose={() => setLiveAlert(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setLiveAlert(null)}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {liveAlert?.title || 'New disease alert received.'}
        </Alert>
      </Snackbar>
    </>
  );
}
