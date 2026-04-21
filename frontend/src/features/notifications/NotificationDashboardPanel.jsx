import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import PanelCard from '@/components/ui/PanelCard';
import StateBlock from '@/components/ui/StateBlock';
import StatusChip from '@/components/ui/StatusChip';
import { formatConfidencePercentage } from '@/features/dashboard/utils';
import { formatInspectionDateTime } from '@/features/inspections/utils';

function formatAlertTimestamp(value) {
  if (!value) {
    return 'No timestamp';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No timestamp';
  }

  return date.toLocaleString();
}

function formatDiseaseLabel(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return 'Disease alert';
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function Lane({
  tone = 'default',
  icon,
  title,
  summary,
  action,
  children,
}) {
  const toneStyles = tone === 'danger'
    ? {
        borderColor: 'error.light',
        background: 'linear-gradient(180deg, rgba(211, 47, 47, 0.07), rgba(255, 255, 255, 0.98))',
        iconBg: 'rgba(211, 47, 47, 0.12)',
        iconColor: 'error.dark',
      }
    : {
        borderColor: 'warning.light',
        background: 'linear-gradient(180deg, rgba(245, 124, 0, 0.08), rgba(255, 255, 255, 0.98))',
        iconBg: 'rgba(245, 124, 0, 0.12)',
        iconColor: 'warning.dark',
      };

  return (
    <Box
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: toneStyles.borderColor,
        borderRadius: 1.5,
        background: toneStyles.background,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={1.1} sx={{ p: 1.2, height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
          <Stack direction="row" spacing={0.9} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                bgcolor: toneStyles.iconBg,
                color: toneStyles.iconColor,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary}
              </Typography>
            </Stack>
          </Stack>
          {action}
        </Stack>

        {children}
      </Stack>
    </Box>
  );
}

function DiseaseAlertPreview({ notification, onOpen }) {
  const inspectionReference = notification.payload?.source_message_id || notification.inspection;
  const isUnread = !notification.is_read;
  const diseaseLabel = formatDiseaseLabel(notification.display_disease_label || notification.title);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.25,
        borderColor: isUnread ? 'error.light' : 'divider',
        bgcolor: isUnread ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.72)',
      }}
    >
      <CardActionArea onClick={() => onOpen(notification)}>
        <CardContent sx={{ p: 1.1, '&:last-child': { pb: 1.1 } }}>
          <Stack spacing={0.7}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  minWidth: 0,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                {diseaseLabel}
              </Typography>
              <Stack spacing={0.45} alignItems="flex-end">
                <StatusChip
                  size="small"
                  tone={notification.severity === 'high' ? 'critical' : 'alert'}
                  label={notification.severity === 'high' ? 'High alert' : 'Alert'}
                />
                <StatusChip
                  size="small"
                  tone={isUnread ? 'alert' : 'neutral'}
                  label={isUnread ? 'Unread' : 'Read'}
                />
              </Stack>
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {notification.message}
            </Typography>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Confidence {formatConfidencePercentage(notification.confidence_score)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Inspection {inspectionReference || 'N/A'}
              </Typography>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              {formatAlertTimestamp(notification.created_at)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ReviewActionPreview({ inspection, onOpenReviewItem }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.25,
        borderColor: 'warning.light',
        bgcolor: 'rgba(255, 255, 255, 0.88)',
      }}
    >
      <CardActionArea onClick={() => onOpenReviewItem(inspection)}>
        <CardContent sx={{ p: 1.1, '&:last-child': { pb: 1.1 } }}>
          <Stack spacing={0.7}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  minWidth: 0,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                {formatDiseaseLabel(inspection.top1_label || 'Manual review')}
              </Typography>
              <StatusChip size="small" tone="review" label="Review required" />
            </Stack>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Confidence {formatConfidencePercentage(inspection.confidence_score)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {inspection.organ_type || 'Unknown organ'}
              </Typography>
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {inspection.device_label || 'Unknown device'}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              Captured {formatInspectionDateTime(inspection.captured_at)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function LaneLoadingState() {
  return (
    <Stack spacing={0.8}>
      {[1, 2].map((item) => (
        <Skeleton key={item} variant="rounded" height={92} />
      ))}
    </Stack>
  );
}

export default function NotificationDashboardPanel({
  notifications,
  unreadCount,
  isLoading,
  isError,
  error,
  onRetry,
  onOpenNotification,
  onMarkAllRead,
  isMarkingAllRead,
  reviewItems,
  reviewCount,
  onOpenReviewItem,
  onOpenReviewWorkspace,
}) {
  const previewNotifications = notifications.slice(0, 3);
  const previewReviewItems = reviewItems.slice(0, 3);

  return (
    <PanelCard
      title="Operational Alerts"
      subtitle="Urgent disease detections and manual review tasks that need attention now."
      badge="Live"
    >
      <Grid container spacing={1}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Lane
            tone="danger"
            icon={<NotificationsActiveRoundedIcon fontSize="small" />}
            title="Disease Alerts"
            summary={unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'} in the current queue.`
              : 'Recent disease-positive notifications from the live system.'}
            action={(
              <Button
                size="small"
                color="error"
                variant="text"
                startIcon={<MarkEmailReadRoundedIcon />}
                onClick={onMarkAllRead}
                disabled={unreadCount === 0 || isMarkingAllRead || isLoading}
              >
                Mark read
              </Button>
            )}
          >
            {isLoading ? <LaneLoadingState /> : null}

            {isError ? (
              <Alert
                severity="error"
                action={(
                  <Button color="inherit" size="small" onClick={onRetry}>
                    Retry
                  </Button>
                )}
              >
                {error?.response?.data?.detail || error?.message || 'Failed to load disease alerts.'}
              </Alert>
            ) : null}

            {!isLoading && !isError && previewNotifications.length === 0 ? (
              <StateBlock
                title="No disease alerts"
                message="New disease-positive inspections will appear here when they are detected."
                minHeight={164}
              />
            ) : null}

            {!isLoading && !isError && previewNotifications.length > 0 ? (
              <Stack spacing={0.8}>
                {previewNotifications.map((notification) => (
                  <DiseaseAlertPreview
                    key={notification.id}
                    notification={notification}
                    onOpen={onOpenNotification}
                  />
                ))}
              </Stack>
            ) : null}
          </Lane>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Lane
            tone="warning"
            icon={<FactCheckRoundedIcon fontSize="small" />}
            title="Review Required"
            summary={reviewCount > 0
              ? `${reviewCount} inspection${reviewCount === 1 ? '' : 's'} currently need manual review.`
              : 'No inspections are currently waiting for manual review.'}
            action={(
              <Button
                size="small"
                color="warning"
                variant="text"
                onClick={onOpenReviewWorkspace}
              >
                Open queue
              </Button>
            )}
          >
            {previewReviewItems.length === 0 ? (
              <StateBlock
                title="Review queue is clear"
                message="Low-confidence inspections will show up here as actionable review tasks."
                minHeight={164}
              />
            ) : (
              <Stack spacing={0.8}>
                {previewReviewItems.map((inspection) => (
                  <ReviewActionPreview
                    key={inspection.id}
                    inspection={inspection}
                    onOpenReviewItem={onOpenReviewItem}
                  />
                ))}
              </Stack>
            )}
          </Lane>
        </Grid>
      </Grid>
    </PanelCard>
  );
}
