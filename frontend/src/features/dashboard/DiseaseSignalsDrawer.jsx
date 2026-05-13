import { Box, Chip, Portal, Stack, Typography } from '@mui/material'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import DrawerCloseButton from '@/components/ui/DrawerCloseButton'
import {
  formatConfidencePercentage,
  resolveNotificationAlertTimestamp,
  resolveNotificationRiskLevel,
} from '@/features/dashboard/utils'
import { cn } from '@/lib/utils'
import { useThemeMode } from '@/theme-mode-context'

function formatDiseaseLabel(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return 'Disease alert'
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatRiskLabel(value) {
  if (!value) {
    return 'Risk unknown'
  }

  return `${value.toUpperCase()} RISK`
}

function formatAlertTimestamp(value) {
  if (!value) {
    return 'No timestamp'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'No timestamp'
  }

  return date.toLocaleString()
}

function resolveDeviceLabel(notification) {
  const deviceName = notification?.payload?.device_name?.trim()
  const deviceIdentifier = notification?.payload?.device_identifier?.trim()

  if (deviceName && deviceIdentifier && deviceIdentifier !== deviceName) {
    return `${deviceName} (${deviceIdentifier})`
  }

  return deviceName || deviceIdentifier || 'Device unavailable'
}

function resolveRiskBadgeClasses(riskLevel) {
  if (riskLevel === 'critical') {
    return 'border-red-200/35 bg-red-400/18 text-red-50'
  }
  if (riskLevel === 'high') {
    return 'border-red-300/30 bg-red-500/14 text-red-100'
  }
  if (riskLevel === 'medium') {
    return 'border-amber-300/28 bg-amber-400/14 text-amber-100'
  }
  if (riskLevel === 'low') {
    return 'border-emerald-300/28 bg-emerald-400/12 text-emerald-100'
  }

  return 'border-slate-300/18 bg-white/[0.05] text-slate-200'
}

function AlertQueueItem({ notification, diseases, onSelect, isLightMode }) {
  const riskLevel = resolveNotificationRiskLevel(notification, diseases)
  const isUnread = !notification.is_read
  const diseaseLabel = formatDiseaseLabel(notification.display_disease_label || notification.title)
  const itemClasses = isLightMode
    ? (isUnread
      ? 'border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(255,255,255,0.98))] shadow-[0_10px_24px_rgba(127,29,29,0.08)] hover:border-red-300 hover:bg-[linear-gradient(180deg,rgba(254,226,226,0.98),rgba(255,255,255,0.98))]'
      : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-red-200 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(254,242,242,0.98))]')
    : (isUnread
      ? 'border-red-300/34 bg-[linear-gradient(180deg,rgba(127,29,29,0.92),rgba(56,13,13,0.96))] shadow-[0_16px_34px_rgba(127,29,29,0.24)] hover:border-red-200/44 hover:bg-[linear-gradient(180deg,rgba(153,27,27,0.94),rgba(68,14,14,0.98))]'
      : 'border-white/14 bg-[linear-gradient(180deg,rgba(19,28,27,0.98),rgba(10,16,15,0.99))] shadow-[0_14px_28px_rgba(0,0,0,0.22)] hover:border-red-300/26 hover:bg-[linear-gradient(180deg,rgba(24,34,33,0.98),rgba(12,18,17,0.99))]')
  const readStateBadgeClasses = isLightMode
    ? (isUnread ? 'border-red-300/60 bg-red-50 text-red-700' : 'border-slate-300 bg-slate-100 text-slate-600')
    : (isUnread ? 'border-red-300/30 bg-red-500/14 text-red-100' : 'border-red-300/24 bg-red-500/10 text-red-200')
  const messageClasses = isLightMode
    ? (isUnread ? 'text-red-800/85' : 'text-slate-600')
    : (isUnread ? 'text-red-100/78' : 'text-slate-300')
  const metaClasses = isLightMode
    ? (isUnread ? 'text-red-700/72' : 'text-slate-500')
    : (isUnread ? 'text-red-100/72' : 'text-slate-400')

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isLightMode ? 'focus-visible:ring-red-400/70 focus-visible:ring-offset-white' : 'focus-visible:ring-red-300/80 focus-visible:ring-offset-slate-950',
        itemClasses,
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', isLightMode ? (isUnread ? 'bg-red-400/70' : 'bg-red-300/55') : (isUnread ? 'bg-red-300/90' : 'bg-red-400/72'))} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className={cn('truncate text-sm font-semibold', isLightMode ? 'text-slate-900' : 'text-slate-50')}>{diseaseLabel}</p>
          <p className={cn('line-clamp-1 text-xs leading-5', isLightMode ? 'text-slate-600' : (isUnread ? 'text-red-50/88' : 'text-slate-300'))}>
            {resolveDeviceLabel(notification)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={resolveRiskBadgeClasses(riskLevel)}
          >
            {formatRiskLabel(riskLevel)}
          </Badge>
          <Badge
            variant="outline"
            className={readStateBadgeClasses}
          >
            {isUnread ? 'Unread' : 'Read'}
          </Badge>
        </div>
      </div>

      <p className={`mt-2 line-clamp-2 text-xs leading-5 ${messageClasses}`}>
        {notification.message || 'Alert details unavailable.'}
      </p>

      <div className={`mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] font-medium ${metaClasses}`}>
        <span>{formatConfidencePercentage(notification.confidence_score)}</span>
        <span>{formatAlertTimestamp(notification.created_at)}</span>
        <span>{notification.payload?.source_message_id || notification.inspection || 'Inspection reference unavailable'}</span>
      </div>
    </button>
  )
}

export default function DiseaseSignalsDrawer({
  open,
  onClose,
  notifications,
  diseases,
  onSelectNotification,
}) {
  const { mode } = useThemeMode()
  const isLightMode = mode === 'light'
  const count = notifications.length
  const newestFirstNotifications = [...notifications].sort((left, right) => (
    resolveNotificationAlertTimestamp(right).localeCompare(resolveNotificationAlertTimestamp(left))
  ))

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: (theme) => theme.zIndex.drawer,
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <Box
          onClick={onClose}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: isLightMode ? 'rgba(15,23,42,0.12)' : 'rgba(2, 6, 23, 0.18)',
          }}
        />

        <Box
          role="dialog"
          aria-modal="false"
          aria-label="Disease signals"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 'min(520px, calc(100vw - 16px))',
            minWidth: 'min(520px, calc(100vw - 16px))',
            maxWidth: 'min(520px, calc(100vw - 16px))',
            height: '100dvh',
            minHeight: '100dvh',
            maxHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: isLightMode ? '#f8fbf8' : '#07110F',
            borderLeft: isLightMode ? '1px solid rgba(203,213,225,0.95)' : '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: isLightMode ? '0 18px 44px rgba(15,23,42,0.16)' : '0 20px 54px rgba(0, 0, 0, 0.34)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 220ms ease',
            willChange: 'transform',
          }}
        >
          <Box
            sx={{
              px: { xs: 1.5, sm: 1.75 },
              py: { xs: 1.15, sm: 1.35 },
              background: isLightMode
                ? 'linear-gradient(160deg, rgba(254,226,226,0.94), rgba(255,255,255,0.98))'
                : 'linear-gradient(160deg, rgba(220, 38, 38, 0.24), rgba(6, 15, 13, 0.98))',
              borderBottom: isLightMode ? '1px solid rgba(226,232,240,0.92)' : '1px solid rgba(148, 163, 184, 0.16)',
              flexShrink: 0,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: isLightMode ? '#b91c1c' : '#FECACA', lineHeight: 1.1, letterSpacing: 1.4 }}
                  >
                    Disease alerts
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: isLightMode ? '#0f172a' : '#F8FAFC',
                      fontWeight: 850,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    Disease Signals
                  </Typography>
                  <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)' }}>
                    Current dashboard disease alerts ordered by unread status, risk, and recency.
                  </Typography>
                </Stack>
                <DrawerCloseButton
                  onClick={onClose}
                  aria-label="Close disease signals"
                />
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`${count} alert${count === 1 ? '' : 's'}`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(248,113,113,0.28)', bgcolor: 'rgba(254,242,242,0.92)', color: '#b91c1c' }
                    : { borderColor: 'rgba(248, 113, 113, 0.28)', color: '#FECACA' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`${notifications.filter((notification) => !notification.is_read).length} unread`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(203,213,225,0.95)', bgcolor: 'rgba(255,255,255,0.82)', color: '#475569' }
                    : { borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              p: { xs: 1.25, sm: 1.5 },
              bgcolor: isLightMode ? '#f1f6f2' : '#050A09',
            }}
          >
            <div className="space-y-3">
              {newestFirstNotifications.map((notification) => (
                <AlertQueueItem
                  key={notification.id}
                  notification={notification}
                  diseases={diseases}
                  onSelect={onSelectNotification}
                  isLightMode={isLightMode}
                />
              ))}
            </div>
          </Box>
        </Box>
      </Box>
    </Portal>
  )
}
