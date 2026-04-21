import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import StateBlock from '@/components/ui/StateBlock';
import StatusChip from '@/components/ui/StatusChip';
import DashboardChartCard from '@/features/dashboard/DashboardChartCard';
import {
  fetchMonitoringReviewsPage,
  fetchMonitoringSummary,
  fetchNotificationReadActivity,
  fetchUserActivity,
} from '@/features/monitoring/api';
import { resolveReviewDecisionTone } from '@/features/review/utils';

function formatDateTime(value, fallback = 'No timestamp') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString();
}

function formatReviewDecisionLabel(value) {
  const normalized = (value || '').trim().toLowerCase();

  if (!normalized) {
    return 'Review';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRoleLabel(value) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) {
    return 'Unknown';
  }

  return normalized === 'admin'
    ? 'Administrator'
    : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatUserLabel(user) {
  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  return fullName || user?.username || 'Unknown user';
}

function formatCountLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const REVIEW_PAGE_SIZE_OPTIONS = [8, 16, 24];

function LatestReviewsCard({
  reviewData,
  isLoading,
  isFetching,
  isError,
  error,
  onRetry,
  paginationModel,
  onPaginationModelChange,
}) {
  const rows = reviewData?.results ?? [];
  const rowCount = reviewData?.count ?? 0;

  const columns = useMemo(
    () => [
      {
        field: 'summary',
        headerName: 'Review',
        flex: 1.8,
        minWidth: 260,
        sortable: false,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.45, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
              {params.row.summary}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Inspection {params.row.inspectionLabel}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'decision',
        headerName: 'Result',
        minWidth: 118,
        flex: 0.6,
        sortable: false,
        renderCell: (params) => (
          <StatusChip
            tone={resolveReviewDecisionTone(params.row.review.decision)}
            label={formatReviewDecisionLabel(params.row.review.decision)}
          />
        ),
      },
      {
        field: 'reviewer',
        headerName: 'Reviewed by',
        minWidth: 160,
        flex: 0.85,
        sortable: false,
        valueGetter: (_, row) => row.reviewerLabel,
      },
      {
        field: 'reviewedAt',
        headerName: 'Reviewed at',
        minWidth: 190,
        flex: 0.95,
        sortable: false,
        valueGetter: (_, row) => row.reviewedAtLabel,
      },
    ],
    [],
  );

  if (isError) {
    return (
      <DashboardChartCard
        title="Latest Reviews"
        subtitle="Recent review activity across the workspace."
        badgeLabel="Review"
        minHeight={360}
      >
        <PanelError
          error={error}
          onRetry={onRetry}
          fallbackMessage="Unable to load recent reviews."
        />
      </DashboardChartCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardChartCard
        title="Latest Reviews"
        subtitle="Recent review activity across the workspace."
        badgeLabel="Review"
        minHeight={360}
        loading
      />
    );
  }

  if (!rows.length) {
    return (
      <DashboardChartCard
        title="Latest Reviews"
        subtitle="Recent review activity across the workspace."
        badgeLabel="Review"
        minHeight={360}
      >
        <StateBlock
          title="No review activity yet"
          message="The latest completed review will appear here once a review is submitted."
          minHeight={180}
        />
      </DashboardChartCard>
    );
  }

  return (
    <DashboardChartCard
      title="Latest Reviews"
      subtitle="Recent review activity across the workspace."
      badgeLabel="Review"
    >
      <Box>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          getRowId={(row) => row.review.id}
          rowHeight={58}
          columnHeaderHeight={38}
          loading={isLoading || isFetching}
          pagination
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          rowCount={rowCount}
          pageSizeOptions={REVIEW_PAGE_SIZE_OPTIONS}
          disableColumnMenu
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          sx={{
            border: 0,
            '& .MuiDataGrid-cell': {
              py: 0.2,
              alignItems: 'center',
            },
            '& .MuiDataGrid-footerContainer': {
              position: 'relative',
              zIndex: 1,
              bgcolor: 'background.paper',
            },
          }}
        />
      </Box>
    </DashboardChartCard>
  );
}

function StatusPill({ status }) {
  const normalized = (status || '').trim().toLowerCase();
  const tone = normalized === 'active'
    ? { color: 'success', label: 'Active now' }
    : { color: 'default', label: 'Offline' };

  return (
    <Chip
      size="small"
      color={tone.color}
      variant={normalized === 'active' ? 'filled' : 'outlined'}
      label={tone.label}
    />
  );
}

function MonitoringLoadingState() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography color="text.secondary">Loading monitoring activity...</Typography>
      </Stack>
    </Box>
  );
}

function PanelError({ error, onRetry, fallbackMessage }) {
  const message = error?.response?.data?.detail || error?.message || fallbackMessage;

  return (
    <Alert
      severity="error"
      action={(
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      )}
    >
      {message}
    </Alert>
  );
}

function ReadActivityList({ items }) {
  if (!items.length) {
    return (
      <StateBlock
        title="No read activity"
        message="Read activity will appear once users begin acknowledging notifications."
        minHeight={180}
      />
    );
  }

  return (
    <List disablePadding>
      {items.map((activity, index) => (
        <ListItem
          key={activity.id}
          disableGutters
          sx={{
            py: 0.95,
            alignItems: 'flex-start',
            borderBottom: index < items.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <ListItemText
            primary={(
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                <Stack spacing={0.35}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatUserLabel(activity.user)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activity.notification_title || 'Notification'}
                  </Typography>
                </Stack>
                <StatusPill status={activity.user?.status} />
              </Stack>
            )}
            secondary={(
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                <Typography variant="caption" color="text.secondary">
                  Role {formatRoleLabel(activity.user?.role?.name)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Read {formatDateTime(activity.read_at)}
                </Typography>
              </Stack>
            )}
          />
        </ListItem>
      ))}
    </List>
  );
}

function UserActivityList({ items }) {
  if (!items.length) {
    return (
      <StateBlock
        title="No user activity"
        message="User activity will appear here when the backend exposes active accounts and recent presence."
        minHeight={180}
      />
    );
  }

  return (
    <List disablePadding>
      {items.map((user, index) => (
        <ListItem
          key={user.id}
          disableGutters
          sx={{
            py: 0.95,
            alignItems: 'flex-start',
            borderBottom: index < items.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <ListItemText
            primary={(
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                <Stack spacing={0.35}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatUserLabel(user)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.username}
                  </Typography>
                </Stack>
                <StatusPill status={user.status} />
              </Stack>
            )}
            secondary={(
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                <Typography variant="caption" color="text.secondary">
                  Role {formatRoleLabel(user.role?.name)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Last seen {formatDateTime(user.last_seen_at, 'No recent activity')}
                </Typography>
              </Stack>
            )}
          />
        </ListItem>
      ))}
    </List>
  );
}

export default function MonitoringPage() {
  const [reviewsPaginationModel, setReviewsPaginationModel] = useState({ page: 0, pageSize: 8 });
  const summaryQuery = useQuery({
    queryKey: ['monitoring-summary'],
    queryFn: fetchMonitoringSummary,
    refetchInterval: 60 * 1000,
  });

  const reviewsQuery = useQuery({
    queryKey: ['monitoring-reviews', reviewsPaginationModel.page, reviewsPaginationModel.pageSize],
    queryFn: () => fetchMonitoringReviewsPage(reviewsPaginationModel),
    refetchInterval: 60 * 1000,
  });

  const readActivityQuery = useQuery({
    queryKey: ['monitoring-notification-read-activity'],
    queryFn: () => fetchNotificationReadActivity({ page_size: 8 }),
    refetchInterval: 60 * 1000,
  });

  const userActivityQuery = useQuery({
    queryKey: ['monitoring-user-activity'],
    queryFn: () => fetchUserActivity({ page_size: 8 }),
    refetchInterval: 60 * 1000,
  });

  const isInitialLoading = summaryQuery.isLoading && !summaryQuery.data;
  const recentReadActivity = useMemo(
    () => summaryQuery.data?.recent_read_activity ?? [],
    [summaryQuery.data],
  );

  if (isInitialLoading) {
    return <MonitoringLoadingState />;
  }

  if (summaryQuery.isError && !summaryQuery.data) {
    return (
      <PanelError
        error={summaryQuery.error}
        onRetry={() => summaryQuery.refetch()}
        fallbackMessage="Failed to load monitoring summary."
      />
    );
  }

  const summary = summaryQuery.data?.summary ?? {};
  const activeRatioLabel = summary.total_user_count
    ? `${summary.active_user_count}/${summary.total_user_count} active`
    : 'No users reported';

  return (
    <Stack spacing={1.75}>
      <PageHeader
        eyebrow="Administration"
        title="Monitoring"
        subtitle="Central visibility into notification volume, reader activity, and current user presence across the operational workspace."
      />

      <Grid container spacing={1.25} alignItems="stretch">
        <Grid size={{ xs: 12, lg: 7 }} sx={{ alignSelf: 'flex-start' }}>
          <LatestReviewsCard
            reviewData={reviewsQuery.data}
            isLoading={reviewsQuery.isLoading && !reviewsQuery.data}
            isFetching={reviewsQuery.isFetching}
            isError={reviewsQuery.isError}
            error={reviewsQuery.error}
            onRetry={() => reviewsQuery.refetch()}
            paginationModel={reviewsPaginationModel}
            onPaginationModelChange={setReviewsPaginationModel}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <DashboardChartCard
            title="Monitoring Overview"
            subtitle="A quick overview of current monitoring activity across the workspace."
            badgeLabel="Summary"
            minHeight={300}
            action={(
              <Chip
                size="small"
                icon={<TimelineRoundedIcon fontSize="small" />}
                label={`${summary.active_user_window_minutes ?? 5} min window`}
                variant="outlined"
              />
            )}
          >
            <Stack spacing={1.1}>
              <PanelCard
                title="Reader coverage"
                subtitle="See how many alerts have already been viewed by at least one user."
                badge="Visibility"
              >
                <Stack spacing={0.85}>
                  <Typography variant="body2" color="text.secondary">
                    {formatCountLabel(summary.notifications_with_reads ?? 0, 'notification')} have already been viewed by at least one user, while {formatCountLabel(summary.notifications_without_reads ?? 0, 'notification')} {summary.notifications_without_reads === 1 ? 'has' : 'have'} not been viewed yet.
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip size="small" label={`${summary.total_read_events ?? 0} read events`} />
                    <Chip size="small" variant="outlined" label={activeRatioLabel} />
                  </Stack>
                </Stack>
              </PanelCard>

              <PanelCard
                title="Recent operational activity"
                subtitle="Recent monitoring actions exposed by the backend summary."
                badge="Live"
              >
                {recentReadActivity.length === 0 ? (
                  <StateBlock
                    title="No recent operational activity"
                    message="Recent notification reads or related monitoring events will appear here when available."
                    minHeight={120}
                  />
                ) : (
                  <List disablePadding>
                    {recentReadActivity.slice(0, 4).map((activity, index) => (
                      <ListItem
                        key={activity.id}
                        disableGutters
                        sx={{
                          py: 0.75,
                          alignItems: 'flex-start',
                          borderBottom: index < Math.min(recentReadActivity.length, 4) - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                        }}
                      >
                        <ListItemText
                          primary={(
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {formatUserLabel(activity.user)}
                            </Typography>
                          )}
                          secondary={(
                            <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">
                                Read {activity.notification_title || 'notification'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(activity.read_at)}
                              </Typography>
                            </Stack>
                          )}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </PanelCard>
            </Stack>
          </DashboardChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={1.25} alignItems="stretch">
        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardChartCard
            title="Notification Read Activity"
            subtitle="See who has recently viewed alerts and who is active right now."
            badgeLabel="Read events"
            minHeight={280}
            loading={readActivityQuery.isLoading && !readActivityQuery.data}
            action={(
              <Chip
                size="small"
                icon={<VisibilityRoundedIcon fontSize="small" />}
                label={`${readActivityQuery.data?.count ?? recentReadActivity.length} events`}
                variant="outlined"
              />
            )}
          >
            {readActivityQuery.isError ? (
              <PanelError
                error={readActivityQuery.error}
                onRetry={() => readActivityQuery.refetch()}
                fallbackMessage="Failed to load notification read activity."
              />
            ) : (
              <ReadActivityList items={readActivityQuery.data?.results ?? recentReadActivity} />
            )}
          </DashboardChartCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardChartCard
            title="Active Users"
            subtitle="View who is currently active and when other users were last seen."
            badgeLabel="Presence"
            minHeight={280}
            loading={userActivityQuery.isLoading && !userActivityQuery.data}
            action={(
              <Chip
                size="small"
                icon={<PeopleAltRoundedIcon fontSize="small" />}
                label={`${summary.active_user_count ?? 0} active`}
                variant="outlined"
              />
            )}
          >
            {userActivityQuery.isError ? (
              <PanelError
                error={userActivityQuery.error}
                onRetry={() => userActivityQuery.refetch()}
                fallbackMessage="Failed to load user activity."
              />
            ) : (
              <UserActivityList items={userActivityQuery.data?.results ?? []} />
            )}
          </DashboardChartCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
