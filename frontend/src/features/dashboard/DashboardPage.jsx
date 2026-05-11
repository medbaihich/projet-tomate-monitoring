import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Alert as MuiAlert, Snackbar } from '@mui/material';
import {
  ClipboardList,
  ClipboardCheck,
  Cpu,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import { fetchDashboardData, fetchDashboardReferenceData } from '@/features/dashboard/api';
import {
  ActivityLineChart,
  DistributionBars,
  DonutBreakdown,
} from '@/features/dashboard/DashboardCharts';
import {
  formatDashboardConfidence,
  formatDashboardCount,
} from '@/features/dashboard/components/dashboardPresentation';
import {
  buildDiseaseAlertCountLabel,
  buildUnreadDiseaseAlertLine,
  getHighestDashboardRisk,
  resolveNotificationDiseaseRecord,
  resolveNotificationAlertTimestamp,
  selectLatestDiseaseAlert,
  selectPriorityDiseaseAlert,
  sortDiseaseAlertsByPriority,
} from '@/features/dashboard/utils';
import DashboardEmptyState from '@/features/dashboard/components/DashboardEmptyState';
import DashboardErrorState from '@/features/dashboard/components/DashboardErrorState';
import DashboardLoadingState from '@/features/dashboard/components/DashboardLoadingState';
import DashboardMetricCard from '@/features/dashboard/components/DashboardMetricCard';
import DiseaseSignalsDrawer from '@/features/dashboard/DiseaseSignalsDrawer';
import DashboardSection from '@/features/dashboard/components/DashboardSection';
import DashboardStatusBadge from '@/features/dashboard/components/DashboardStatusBadge';
import PendingReviewsDrawer from '@/features/dashboard/PendingReviewsDrawer';
import { Button } from '@/components/ui/button';
import MapFoundation from '@/features/map/MapFoundation';
import { DASHBOARD_DISEASE_MAP_SIGNALS_QUERY_KEY } from '@/features/map/api';
import {
  fetchNotificationsPage,
  fetchUnreadNotificationsCount,
  markNotificationRead,
  NOTIFICATIONS_PAGE_SIZE,
} from '@/features/notifications/api';
import NotificationDetailDrawer from '@/features/notifications/NotificationDetailDrawer';
import { resolveInspectionDiseaseLabel } from '@/features/inspections/utils';
import useAuthStore from '@/store/authStore';

const NOTIFICATIONS_QUERY_KEY = ['dashboard-notifications'];
const UNREAD_COUNT_QUERY_KEY = ['dashboard-notifications-unread-count'];
const DASHBOARD_REFERENCE_QUERY_KEY = ['dashboard-reference-data'];
const DASHBOARD_MAP_REFRESH_DEBOUNCE_MS = 1500;
const DASHBOARD_MAP_SELECT_CLASS = 'h-9 min-w-[16rem] rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

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
  return resolveNotificationDiseaseRecord(notification, diseases)
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

function formatLastUpdatedLabel(value) {
  if (!value) {
    return 'Awaiting dashboard sync';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Awaiting dashboard sync';
  }

  return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRiskPillLabel(riskLevel) {
  if (!riskLevel) {
    return 'NO ACTIVE RISK'
  }

  return `${riskLevel.toUpperCase()} RISK`
}

function resolveRiskPillClasses(riskLevel) {
  if (riskLevel === 'critical') {
    return 'border-red-300/35 bg-red-500/18 text-red-50'
  }

  if (riskLevel === 'high') {
    return 'border-red-400/20 bg-red-500/10 text-red-200'
  }

  if (riskLevel === 'medium') {
    return 'border-amber-300/24 bg-amber-500/12 text-amber-100'
  }

  if (riskLevel === 'low') {
    return 'border-emerald-300/24 bg-emerald-500/10 text-emerald-100'
  }

  return 'border-white/10 bg-black/20 text-slate-400'
}

function ProcessingPipeline({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.some((item) => item.value > 0)) {
    return (
      <DashboardEmptyState
        title="No processing data"
        message="Processing status will appear here after inspection records are available."
        badgeLabel="Pipeline"
        framed={false}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {data.map((item, index) => {
        const percentage = total ? Math.round((item.value / total) * 100) : 0;

        return (
          <div
            key={item.key || item.label}
            className="relative min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-sm font-semibold text-slate-950"
                style={{ backgroundColor: item.color }}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-100">{item.label}</p>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-50">
                    {formatDashboardCount(item.value)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(percentage, item.value > 0 ? 8 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-[0.68rem] font-medium text-slate-500">{percentage}% of tracked inspections</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDiseaseSignalsOpen, setIsDiseaseSignalsOpen] = useState(false);
  const [isPendingReviewsOpen, setIsPendingReviewsOpen] = useState(false);
  const [liveAlert, setLiveAlert] = useState(null);
  const [selectedMapDeviceId, setSelectedMapDeviceId] = useState('');
  const selectedMapDeviceIdRef = useRef('');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    dataUpdatedAt,
    isFetching,
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

  useEffect(() => {
    selectedMapDeviceIdRef.current = selectedMapDeviceId;
  }, [selectedMapDeviceId]);

  useEffect(() => {
    const websocketUrl = buildNotificationsWebSocketUrl(accessToken);
    if (!websocketUrl) {
      return undefined;
    }

    let socket;
    let reconnectTimeoutId;
    let dashboardMapRefreshTimeoutId;
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

          if (!dashboardMapRefreshTimeoutId) {
            dashboardMapRefreshTimeoutId = window.setTimeout(() => {
              dashboardMapRefreshTimeoutId = null;
              queryClient.invalidateQueries({
                predicate: (query) => {
                  const queryKey = query.queryKey;
                  return (
                    Array.isArray(queryKey)
                    && queryKey[0] === DASHBOARD_DISEASE_MAP_SIGNALS_QUERY_KEY[0]
                    && queryKey[1] === DASHBOARD_DISEASE_MAP_SIGNALS_QUERY_KEY[1]
                    && queryKey[2] === DASHBOARD_DISEASE_MAP_SIGNALS_QUERY_KEY[2]
                    && !queryKey.includes('filter-options')
                  );
                },
              });
            }, DASHBOARD_MAP_REFRESH_DEBOUNCE_MS);
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
      if (dashboardMapRefreshTimeoutId) {
        window.clearTimeout(dashboardMapRefreshTimeoutId);
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
  const diseases = useMemo(
    () => dashboardReferenceQuery.data?.diseases ?? [],
    [dashboardReferenceQuery.data?.diseases],
  );
  const orderedDiseaseAlerts = useMemo(
    () => sortDiseaseAlertsByPriority(notifications, diseases),
    [notifications, diseases],
  )
  const latestDiseaseAlert = useMemo(
    () => selectLatestDiseaseAlert(orderedDiseaseAlerts),
    [orderedDiseaseAlerts],
  )
  const priorityDiseaseAlert = useMemo(
    () => selectPriorityDiseaseAlert(orderedDiseaseAlerts, diseases),
    [diseases, orderedDiseaseAlerts],
  )
  const latestAlertDiseaseLabel = formatDiseaseLabel(
    latestDiseaseAlert?.display_disease_label || latestDiseaseAlert?.title,
  );
  const latestAlertReadStateLabel = latestDiseaseAlert
    ? latestDiseaseAlert.is_read
      ? 'Read'
      : 'Unread'
    : 'No alert';
  const latestAlertCountLabel = buildDiseaseAlertCountLabel(orderedDiseaseAlerts) ?? latestAlertReadStateLabel
  const unreadDiseaseAlertLine = buildUnreadDiseaseAlertLine(orderedDiseaseAlerts)
  const latestAlertConfidenceLabel = latestDiseaseAlert
    ? `Confidence ${formatDashboardConfidence(latestDiseaseAlert.confidence_score)}`
    : 'No current disease alert';
  const latestAlertDeviceLabel = resolveLatestAlertDeviceLabel(latestDiseaseAlert);
  const latestAlertTimestampLabel = formatAlertTimestamp(resolveNotificationAlertTimestamp(latestDiseaseAlert));
  const highestActiveRiskLevel = useMemo(
    () => getHighestDashboardRisk(orderedDiseaseAlerts, diseases),
    [diseases, orderedDiseaseAlerts],
  )
  const hasUnreadLatestAlert = Boolean(latestDiseaseAlert && !latestDiseaseAlert.is_read);

  const deviceMap = useMemo(
    () => new Map((dashboardReferenceQuery.data?.devices ?? []).map((device) => [device.id, device])),
    [dashboardReferenceQuery.data?.devices],
  );
  const diseaseMap = useMemo(
    () => new Map(diseases.map((disease) => [disease.id, disease])),
    [diseases],
  );
  const dashboardMapDeviceOptions = useMemo(
    () => [...(dashboardReferenceQuery.data?.devices ?? [])]
      .map((device) => ({
        id: device.id,
        label: `${device.name} (${device.identifier})`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [dashboardReferenceQuery.data?.devices],
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
  const handleOpenDiseaseSignals = () => {
    if (!priorityDiseaseAlert) {
      return
    }

    if (orderedDiseaseAlerts.length > 1) {
      setIsDiseaseSignalsOpen(true)
      return
    }

    handleOpenNotification(priorityDiseaseAlert)
  }
  const handleCloseDiseaseSignals = () => {
    setIsDiseaseSignalsOpen(false)
  }
  const handleOpenPendingReviews = () => {
    if (summary.pendingReviewCount > 0) {
      setIsPendingReviewsOpen(true);
    }
  };
  const handleClosePendingReviews = () => {
    setIsPendingReviewsOpen(false);
  };

  const handleOpenReviewItem = (inspection) => {
    setIsPendingReviewsOpen(false);
    navigate('/review', {
      state: {
        focusInspectionId: inspection.id,
      },
    });
  };

  if (isLoading || dashboardReferenceQuery.isLoading) {
    return (
      <DashboardLoadingState
        title="Loading dashboard"
        subtitle="Preparing live inspection, review, and alert summaries."
      />
    );
  }

  if (isError || dashboardReferenceQuery.isError) {
    const activeError = error || dashboardReferenceQuery.error;

    return (
      <DashboardErrorState
        title="Dashboard unavailable"
        message={activeError?.response?.data?.detail || activeError?.message || 'Failed to load dashboard data.'}
        onRetry={() => {
          refetch();
          dashboardReferenceQuery.refetch();
        }}
      />
    );
  }

  const { summary } = data;

  return (
    <>
      <div className="mx-auto min-w-0 max-w-[1600px] overflow-x-hidden pb-3">
        <div className="min-w-0 space-y-3">
          <section className="min-w-0 rounded-[20px] border border-white/8 bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:px-5">
            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-10 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_18px_rgba(74,222,128,0.24)] sm:block" />
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-50 sm:text-[1.85rem]">
                    Dashboard
                  </h1>
                  <p className="mt-0.5 max-w-3xl text-sm leading-5 text-slate-400">
                    Real-time monitoring of tomato crop health and disease risk signals.
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
                <DashboardStatusBadge
                  label={priorityDiseaseAlert ? 'Alert active' : 'System stable'}
                  tone={priorityDiseaseAlert ? 'alert' : 'completed'}
                />
                <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${resolveRiskPillClasses(highestActiveRiskLevel)}`}>
                  {formatRiskPillLabel(highestActiveRiskLevel)}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-slate-400">
                  {formatLastUpdatedLabel(dataUpdatedAt)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetch();
                    dashboardReferenceQuery.refetch();
                    notificationsQuery.refetch();
                    unreadCountQuery.refetch();
                  }}
                  disabled={isFetching || dashboardReferenceQuery.isFetching}
                  className="h-8 rounded-full border-white/10 bg-emerald-500/10 px-3 text-xs text-emerald-100 hover:bg-emerald-500/20"
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </div>
          </section>

          <section className="grid w-full min-w-0 grid-cols-[repeat(4,minmax(0,1fr))] gap-2.5 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 xl:gap-3">
            <DashboardMetricCard
              title="Total Inspections"
              value={formatDashboardCount(summary.inspectionCount)}
              helper="Tracked inspection records across the workspace."
              accent="primary"
              icon={<ClipboardList className="h-5 w-5" />}
              chipLabel="Inspections"
              trendLabel={`${summary.recentInspectionCount} in 7d`}
              footerLabel={summary.inspectionFreshnessLabel}
              className="min-w-0 w-full h-full"
            />
            <DashboardMetricCard
              title="Active Devices"
              value={formatDashboardCount(summary.deviceCount)}
              helper="Configured devices in the live hierarchy."
              accent="info"
              icon={<Cpu className="h-5 w-5" />}
              chipLabel="Devices"
              trendLabel={summary.deviceCount > 0 ? 'Configured' : 'Unconfigured'}
              footerLabel="Synced from the current device registry"
              className="min-w-0 w-full h-full"
            />
            <DashboardMetricCard
              title="Disease Signal"
              value={latestAlertDiseaseLabel}
              helper={latestAlertDeviceLabel}
              secondaryHelper={unreadDiseaseAlertLine}
              accent={hasUnreadLatestAlert ? 'danger' : priorityDiseaseAlert ? 'alert' : 'neutral'}
              icon={<ShieldAlert className="h-5 w-5" />}
              chipLabel={latestAlertCountLabel}
              trendLabel={latestAlertConfidenceLabel}
              footerLabel={latestAlertTimestampLabel}
              className="min-w-0 w-full h-full"
              onClick={latestDiseaseAlert ? handleOpenDiseaseSignals : undefined}
              disabled={!latestDiseaseAlert}
              ariaLabel={latestDiseaseAlert ? `Open disease signal details for ${latestAlertDiseaseLabel}` : 'No disease signal available'}
              pulse={hasUnreadLatestAlert}
              emphasized={hasUnreadLatestAlert}
            />
            <DashboardMetricCard
              title="Pending Reviews"
              value={formatDashboardCount(summary.pendingReviewCount)}
              helper="Low-confidence inspections awaiting review."
              accent={summary.pendingReviewCount > 0 ? 'warning' : 'success'}
              icon={<ClipboardCheck className="h-5 w-5" />}
              chipLabel="Review queue"
              trendLabel={`${formatDashboardCount(summary.reviewCount)} completed`}
              footerLabel="Review rule preserved from Phase 2"
              className="min-w-0 w-full h-full"
              onClick={summary.pendingReviewCount > 0 ? handleOpenPendingReviews : undefined}
              disabled={summary.pendingReviewCount === 0}
              ariaLabel={summary.pendingReviewCount > 0 ? 'Open pending reviews queue' : 'No pending reviews available'}
            />
          </section>

          <DashboardSection
            title="Device Location Overview"
            subtitle="Approximate mapped device positions and disease zones using DB-backed profile semantics."
            badgeLabel="Map foundation"
            className="h-full"
            contentClassName="pt-0"
          >
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-400">
                  <span>Device</span>
                  <select
                    value={selectedMapDeviceId}
                    onChange={(event) => setSelectedMapDeviceId(event.target.value)}
                    className={DASHBOARD_MAP_SELECT_CLASS}
                    aria-label="Filter dashboard map by device"
                  >
                    <option value="">All devices</option>
                    {dashboardMapDeviceOptions.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-500">
                  Device is the only dashboard map filter in this limited Phase 8 scope.
                </p>
              </div>

              <MapFoundation
                enableDiseaseLayers
                showFilters={false}
                selectedDeviceId={selectedMapDeviceId}
                focusInspectionId={latestDiseaseAlert?.inspection || ''}
                diseaseMapFilters={{
                  device: selectedMapDeviceId,
                }}
              />
            </div>
          </DashboardSection>

          <DashboardSection
            title="Inspection Activity"
            subtitle="Capture volume across the current seven-day activity window."
            badgeLabel="Recent activity"
            className="h-full"
            contentClassName="pt-0"
          >
            <ActivityLineChart data={summary.inspectionActivity} />
          </DashboardSection>

          <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DashboardSection
              title="Confidence Distribution"
              subtitle="Current model signal spread across all available inspection records."
              badgeLabel="Model signal"
              className="h-full"
              contentClassName="pt-0"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Avg.</span>
                  <span className="text-lg font-semibold tracking-[-0.04em] text-slate-50">
                    {formatDashboardConfidence(summary.averageConfidence)}
                  </span>
                </div>
                <DistributionBars
                  data={summary.confidenceDistribution}
                  valueFormatter={(value) => `${value} samples`}
                />
              </div>
            </DashboardSection>

            <DashboardSection
              title="Review Decisions"
              subtitle="Accepted, corrected, and rejected outcomes."
              badgeLabel="Quality control"
              className="h-full"
              contentClassName="pt-0"
            >
              <DonutBreakdown
                data={summary.reviewDecisionBreakdown}
                centerLabel="Reviews"
                centerValue={summary.reviewCount}
              />
            </DashboardSection>

            <DashboardSection
              title="Organ Type Mix"
              subtitle="Leaf versus fruit workload in the current inspection set."
              badgeLabel="Input mix"
              className="h-full"
              contentClassName="pt-0"
            >
              <DonutBreakdown
                data={summary.organTypeBreakdown}
                centerLabel="Organs"
                centerValue={summary.inspectionCount}
              />
            </DashboardSection>

            <DashboardSection
              title="Inspection Status"
              subtitle="Lifecycle state across persisted inspections."
              badgeLabel="Lifecycle"
              className="h-full"
              contentClassName="pt-0"
            >
              <DistributionBars data={summary.inspectionStatusBreakdown} />
            </DashboardSection>
          </div>

          <DashboardSection
            title="Processing Pipeline"
            subtitle="Backend processing status across inspection records."
            badgeLabel="Execution"
            className="h-full"
            contentClassName="pt-0"
          >
            <ProcessingPipeline data={summary.processingStatusBreakdown} />
          </DashboardSection>
        </div>
      </div>

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

      <DiseaseSignalsDrawer
        open={isDiseaseSignalsOpen}
        onClose={handleCloseDiseaseSignals}
        notifications={orderedDiseaseAlerts}
        diseases={diseases}
        onSelectNotification={(notification) => {
          setIsDiseaseSignalsOpen(false)
          handleOpenNotification(notification)
        }}
      />

      <PendingReviewsDrawer
        open={isPendingReviewsOpen}
        onClose={handleClosePendingReviews}
        inspections={reviewActionItems}
        onSelectInspection={handleOpenReviewItem}
      />

      <Snackbar
        open={Boolean(liveAlert)}
        autoHideDuration={5000}
        onClose={() => setLiveAlert(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MuiAlert
          onClose={() => setLiveAlert(null)}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {liveAlert?.title || 'New disease alert received.'}
        </MuiAlert>
      </Snackbar>
    </>
  );
}
