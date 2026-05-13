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
import { useThemeMode } from '@/theme-mode-context';

const NOTIFICATIONS_QUERY_KEY = ['dashboard-notifications'];
const UNREAD_COUNT_QUERY_KEY = ['dashboard-notifications-unread-count'];
const DASHBOARD_REFERENCE_QUERY_KEY = ['dashboard-reference-data'];
const DASHBOARD_MAP_REFRESH_DEBOUNCE_MS = 1500;
const CONFIDENCE_BUCKET_LABELS = {
  reviewable: '\u2264 50%',
  watch: `51\u201369%`,
  strong: `70\u201384%`,
  high: '\u2265 85%',
};

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

function formatDecisionLabel(value) {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isSameLocalDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function formatLatestInspectionLabel(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  const now = new Date();
  if (isSameLocalDay(date, now)) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeActivityTime(value) {
  if (!value) {
    return 'No recent activity';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No recent activity';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
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

function resolveRiskPillClasses(riskLevel, isLightMode) {
  if (isLightMode) {
    if (riskLevel === 'critical') {
      return 'border-red-200 bg-red-50/95 text-red-800'
    }

    if (riskLevel === 'high') {
      return 'border-red-200 bg-red-50/90 text-red-700'
    }

    if (riskLevel === 'medium') {
      return 'border-amber-200 bg-amber-50/95 text-amber-800'
    }

    if (riskLevel === 'low') {
      return 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
    }

    return 'border-slate-200 bg-white/88 text-slate-500'
  }

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

function ProcessingPipeline({ data, isLightMode = false }) {
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
            className={`relative min-w-0 rounded-2xl border p-3 ${
              isLightMode
                ? 'border-slate-200 bg-white/86 shadow-[0_12px_26px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.88)]'
                : 'border-white/14 bg-white/[0.055] shadow-[0_10px_24px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-semibold text-slate-950 ${
                  isLightMode
                    ? 'border-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]'
                    : 'border-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                }`}
                style={{ backgroundColor: item.color }}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm font-semibold ${isLightMode ? 'text-slate-900' : 'text-slate-100'}`}>{item.label}</p>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${isLightMode ? 'text-slate-950' : 'text-slate-50'}`}>
                    {formatDashboardCount(item.value)}
                  </span>
                </div>
                <div className={`mt-2 h-1.5 overflow-hidden rounded-full border ${isLightMode ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-white/12'}`}>
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
            <p className={`mt-2 text-[0.68rem] font-medium ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>{percentage}% total</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const dashboardMapSelectClass = isLightMode
    ? 'h-9 min-w-[16rem] rounded-md border border-slate-200 bg-white/92 px-3 text-sm text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.05)] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f8f5]'
    : 'h-9 min-w-[16rem] rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
  const dashboardMapLabelClass = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const summaryTileClass = isLightMode
    ? 'rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 shadow-[0_10px_22px_rgba(15,23,42,0.04)]'
    : 'rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5';
  const summaryTileLabelClass = isLightMode ? 'text-slate-500' : 'text-slate-500';
  const summaryTileValueClass = isLightMode ? 'text-slate-900' : 'text-slate-100';
  const averageConfidencePillClass = isLightMode
    ? 'flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/82 px-3 py-2 shadow-[0_10px_22px_rgba(15,23,42,0.04)]'
    : 'flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2';
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
  const totalInspectionInsights = useMemo(() => {
    const allInspections = data?.allInspections ?? [];
    const now = new Date();

    let todayCount = 0;
    let latestTimestamp = '';

    allInspections.forEach((inspection) => {
      const timestamp = resolveInspectionTimestamp(inspection);
      if (!timestamp) {
        return;
      }

      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      if (!latestTimestamp || timestamp.localeCompare(latestTimestamp) > 0) {
        latestTimestamp = timestamp;
      }

      if (isSameLocalDay(date, now)) {
        todayCount += 1;
      }
    });

    return [
      {
        label: 'Today',
        value: formatDashboardCount(todayCount),
      },
      {
        label: 'Latest',
        value: formatLatestInspectionLabel(latestTimestamp),
      },
    ];
  }, [data?.allInspections]);
  const confidenceDistributionData = useMemo(
    () => (data?.summary?.confidenceDistribution ?? []).map((item) => ({
      ...item,
      label: CONFIDENCE_BUCKET_LABELS[item.key] ?? item.label,
    })),
    [data?.summary?.confidenceDistribution],
  );
  const organTypeInsights = useMemo(() => {
    const organTypeBreakdown = data?.summary?.organTypeBreakdown ?? [];
    if (!organTypeBreakdown.length) {
      return null;
    }

    const total = organTypeBreakdown.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
      return null;
    }

    const [firstItem, secondItem] = [...organTypeBreakdown].sort((left, right) => right.value - left.value);
    const dominantPercentage = Math.round((firstItem.value / total) * 100);
    const volumeGap = firstItem.value - (secondItem?.value ?? 0);

    return {
      dominantLabel: `${firstItem.label} - ${dominantPercentage}%`,
      gapLabel: volumeGap > 0
        ? `+${formatDashboardCount(volumeGap)} vs ${secondItem?.label ?? 'other'}`
        : 'Even split',
    };
  }, [data?.summary?.organTypeBreakdown]);
  const reviewDecisionInsights = useMemo(() => {
    const reviewDecisionBreakdown = data?.summary?.reviewDecisionBreakdown ?? [];
    const totalDecisions = data?.summary?.reviewCount ?? 0;

    if (!reviewDecisionBreakdown.length || totalDecisions <= 0) {
      return null;
    }

    const [dominantDecision] = [...reviewDecisionBreakdown].sort((left, right) => right.value - left.value);
    const dominantPercentage = Math.round((dominantDecision.value / totalDecisions) * 100);

    return {
      dominantLabel: `${dominantDecision.label} - ${dominantPercentage}%`,
      recordedLabel: `${formatDashboardCount(totalDecisions)} decisions recorded`,
    };
  }, [data?.summary?.reviewDecisionBreakdown, data?.summary?.reviewCount]);
  const latestDeviceActivity = useMemo(() => {
    const allInspections = data?.allInspections ?? [];

    let latestInspection = null;
    let latestTimestamp = '';

    allInspections.forEach((inspection) => {
      const timestamp = resolveInspectionTimestamp(inspection);
      if (!timestamp) {
        return;
      }

      if (!latestTimestamp || timestamp.localeCompare(latestTimestamp) > 0) {
        latestTimestamp = timestamp;
        latestInspection = inspection;
      }
    });

    if (!latestInspection || !latestTimestamp) {
      return null;
    }

    const deviceRecord = deviceMap.get(latestInspection.device);
    const deviceLabel = deviceRecord?.name || deviceRecord?.identifier || 'Unknown device';

    return {
      deviceLabel,
      activityLabel: formatRelativeActivityTime(latestTimestamp),
    };
  }, [data?.allInspections, deviceMap]);
  const oldestPendingReview = useMemo(() => {
    if (!reviewActionItems.length) {
      return null;
    }

    return reviewActionItems.reduce((oldestInspection, inspection) => {
      const inspectionTimestamp = resolveInspectionTimestamp(inspection);
      const oldestTimestamp = resolveInspectionTimestamp(oldestInspection);

      if (!oldestTimestamp) {
        return inspection;
      }

      if (!inspectionTimestamp) {
        return oldestInspection;
      }

      return inspectionTimestamp.localeCompare(oldestTimestamp) < 0 ? inspection : oldestInspection;
    }, reviewActionItems[0]);
  }, [reviewActionItems]);
  const latestCompletedReview = useMemo(() => {
    const allReviews = data?.allReviews ?? [];
    if (!allReviews.length) {
      return null;
    }

    const review = [...allReviews]
      .filter((item) => item.reviewed_at)
      .sort((left, right) => right.reviewed_at.localeCompare(left.reviewed_at))[0];

    if (!review) {
      return null;
    }

    const inspection = (data?.allInspections ?? []).find((item) => item.id === review.inspection) ?? null;
    const device = inspection ? deviceMap.get(inspection.device) : null;

    return {
      deviceLabel: device ? `${device.name} (${device.identifier})` : 'Unknown device',
      reviewedAt: review.reviewed_at,
      decisionLabel: formatDecisionLabel(review.decision),
    };
  }, [data?.allInspections, data?.allReviews, deviceMap]);

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
          <section className="min-w-0 py-1">
            <div className="flex min-w-0 flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-10 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_18px_rgba(74,222,128,0.24)] sm:block" />
                <h1 className={`min-w-0 text-2xl font-semibold tracking-[-0.04em] sm:text-[1.85rem] ${isLightMode ? 'text-slate-950' : 'text-slate-50'}`}>
                  Dashboard
                </h1>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
                <DashboardStatusBadge
                  label={priorityDiseaseAlert ? 'Alert active' : 'System stable'}
                  tone={priorityDiseaseAlert ? 'alert' : 'completed'}
                />
                <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${isLightMode ? 'shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]' : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'} ${resolveRiskPillClasses(highestActiveRiskLevel, isLightMode)}`}>
                  {formatRiskPillLabel(highestActiveRiskLevel)}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] ${isLightMode ? 'border-slate-200 bg-white/90 text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.82)_inset]' : 'border-white/10 bg-black/20 text-slate-400'}`}>
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
                  className={isLightMode
                    ? 'h-8 rounded-full border-emerald-200 bg-white/92 px-3 text-xs text-emerald-800 shadow-[0_8px_20px_rgba(29,107,67,0.06)] hover:border-emerald-300 hover:bg-emerald-50'
                    : 'h-8 rounded-full border-white/10 bg-emerald-500/10 px-3 text-xs text-emerald-100 hover:bg-emerald-500/20'}
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
              insightItems={totalInspectionInsights}
              accent="primary"
              icon={<ClipboardList className="h-5 w-5" />}
              chipLabel="Inspections"
              trendLabel={`${summary.recentInspectionCount} in 7d`}
              className="min-w-0 w-full h-full"
            />
            <DashboardMetricCard
              title="Active Devices"
              value={formatDashboardCount(summary.deviceCount)}
              helper={latestDeviceActivity?.deviceLabel ?? 'No device activity yet'}
              secondaryHelper={latestDeviceActivity ? `Last activity · ${latestDeviceActivity.activityLabel}` : undefined}
              accent="info"
              icon={<Cpu className="h-5 w-5" />}
              chipLabel="Devices"
              trendLabel={summary.deviceCount > 0 ? 'Configured' : 'Unconfigured'}
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
              wrapValue
            />
            <DashboardMetricCard
              title="Pending Reviews"
              value={formatDashboardCount(summary.pendingReviewCount)}
              helper={summary.pendingReviewCount > 0
                ? oldestPendingReview?.device_label ?? 'Unknown device'
                : latestCompletedReview?.deviceLabel ?? 'No review history yet'}
              secondaryHelper={summary.pendingReviewCount > 0 && oldestPendingReview
                ? `Oldest pending - ${formatRelativeActivityTime(resolveInspectionTimestamp(oldestPendingReview))}`
                : latestCompletedReview?.reviewedAt
                  ? `Last review - ${formatLatestInspectionLabel(latestCompletedReview.reviewedAt)}`
                  : undefined}
              footerLabel={summary.pendingReviewCount > 0 ? undefined : latestCompletedReview?.decisionLabel ?? undefined}
              accent={summary.pendingReviewCount > 0 ? 'warning' : 'success'}
              icon={<ClipboardCheck className="h-5 w-5" />}
              chipLabel="Review queue"
              trendLabel={`${formatDashboardCount(summary.reviewCount)} completed`}
              className="min-w-0 w-full h-full"
              onClick={summary.pendingReviewCount > 0 ? handleOpenPendingReviews : undefined}
              disabled={summary.pendingReviewCount === 0}
              ariaLabel={summary.pendingReviewCount > 0 ? 'Open pending reviews queue' : 'No pending reviews available'}
              pulse={summary.pendingReviewCount > 0}
              emphasized={summary.pendingReviewCount > 0}
              attentionTone="warning"
            />
          </section>

          <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <DashboardSection
              title="Infection Map"
              badgeLabel="Map foundation"
              className="min-w-0 h-full"
              contentClassName="min-w-0 pt-0"
            >
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className={`flex min-w-0 flex-col gap-1 text-xs font-medium ${dashboardMapLabelClass}`}>
                    <span>Device</span>
                    <select
                      value={selectedMapDeviceId}
                      onChange={(event) => setSelectedMapDeviceId(event.target.value)}
                      className={dashboardMapSelectClass}
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
                </div>

                <MapFoundation
                  enableDiseaseLayers
                  showFilters={false}
                  selectedDeviceId={selectedMapDeviceId}
                  focusInspectionId={latestDiseaseAlert?.inspection || ''}
                  diseaseMapFilters={{
                    device: selectedMapDeviceId,
                    latest_per_device: true,
                  }}
                  referenceDiseases={diseases}
                  legendMode="disease-profiles"
                  adaptiveViewport
                  mapHeightClassName="h-[24rem] lg:h-[30rem]"
                />
              </div>
            </DashboardSection>

            <div className="min-w-0 space-y-3 self-start">
              <DashboardSection
                title="Inspection Activity"
                badgeLabel="Recent activity"
                className="min-w-0"
                contentClassName="min-w-0 pt-0"
              >
                <div className="min-w-0">
                  <ActivityLineChart data={summary.inspectionActivity} height={156} />
                </div>
              </DashboardSection>

              <DashboardSection
                title="Confidence Distribution"
                badgeLabel="Model signal"
                className="min-w-0"
                contentClassName="min-w-0 pt-0"
              >
                <div className="min-w-0 space-y-3">
                  <div className={averageConfidencePillClass}>
                    <span className={`text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Avg.</span>
                    <span className={`text-lg font-semibold tracking-[-0.04em] ${isLightMode ? 'text-slate-950' : 'text-slate-50'}`}>
                      {formatDashboardConfidence(summary.averageConfidence)}
                    </span>
                  </div>
                  <DistributionBars
                    data={confidenceDistributionData}
                    valueFormatter={(value) => `${value} samples`}
                    orientation="vertical"
                  />
                </div>
              </DashboardSection>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2">
            <DashboardSection
              title="Organ Type Mix"
              badgeLabel="Input mix"
              className="h-full"
              contentClassName="pt-0"
            >
              <div className="space-y-3">
                <DonutBreakdown
                  data={summary.organTypeBreakdown}
                  centerLabel="Organs"
                  centerValue={summary.inspectionCount}
                />
                {organTypeInsights ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={summaryTileClass}>
                      <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${summaryTileLabelClass}`}>
                        Dominant input
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${summaryTileValueClass}`}>
                        {organTypeInsights.dominantLabel}
                      </p>
                    </div>
                    <div className={summaryTileClass}>
                      <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${summaryTileLabelClass}`}>
                        Volume gap
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${summaryTileValueClass}`}>
                        {organTypeInsights.gapLabel}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </DashboardSection>

            <DashboardSection
              title="Review Decisions"
              badgeLabel="Quality control"
              className="h-full"
              contentClassName="pt-0"
            >
              <div className="space-y-3">
                <DonutBreakdown
                  data={summary.reviewDecisionBreakdown}
                  centerLabel="Reviews"
                  centerValue={summary.reviewCount}
                />
                {reviewDecisionInsights ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={summaryTileClass}>
                      <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${summaryTileLabelClass}`}>
                        Dominant decision
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${summaryTileValueClass}`}>
                        {reviewDecisionInsights.dominantLabel}
                      </p>
                    </div>
                    <div className={summaryTileClass}>
                      <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${summaryTileLabelClass}`}>
                        Decisions recorded
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${summaryTileValueClass}`}>
                        {reviewDecisionInsights.recordedLabel}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </DashboardSection>
          </div>

          <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2">
            <DashboardSection
              title="Inspection Status"
              badgeLabel="Lifecycle"
              className="h-full"
              contentClassName="pt-0"
            >
              <DistributionBars data={summary.inspectionStatusBreakdown} />
            </DashboardSection>

            <DashboardSection
              title="Processing Pipeline"
              badgeLabel="Execution"
              className="h-full"
              contentClassName="pt-0"
            >
              <ProcessingPipeline data={summary.processingStatusBreakdown} isLightMode={isLightMode} />
            </DashboardSection>
          </div>
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
