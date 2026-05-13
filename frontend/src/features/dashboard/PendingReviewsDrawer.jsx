import { Box, Chip, Portal, Stack, Typography } from '@mui/material'
import { ClipboardCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import DrawerCloseButton from '@/components/ui/DrawerCloseButton'
import { cn } from '@/lib/utils'
import { formatConfidencePercentage } from '@/features/dashboard/utils'
import { formatReviewDateTime } from '@/features/review/utils'
import { useThemeMode } from '@/theme-mode-context'

function formatDiseaseLabel(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return 'Manual review'
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatOrganLabel(value) {
  if (!value) {
    return 'Unknown organ'
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function ReviewQueueItem({ inspection, onSelect, isLightMode }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(inspection)}
      className={cn(
        'w-full rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isLightMode
          ? 'border-amber-300/45 bg-amber-50 hover:bg-amber-100/80 focus-visible:ring-amber-400/70 focus-visible:ring-offset-white'
          : 'border-amber-300/20 bg-amber-400/[0.08] hover:bg-amber-400/[0.14] focus-visible:ring-amber-300/80 focus-visible:ring-offset-slate-950',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className={cn('truncate text-sm font-semibold', isLightMode ? 'text-slate-900' : 'text-slate-50')}>
            {formatDiseaseLabel(inspection.top1_label)}
          </p>
          <p className={cn('line-clamp-1 text-xs leading-5', isLightMode ? 'text-slate-600' : 'text-slate-300')}>
            {inspection.device_label || 'Unknown device'}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold',
            isLightMode
              ? 'border-amber-300/60 bg-amber-100 text-amber-800'
              : 'border-amber-300/30 bg-amber-400/14 text-amber-100',
          )}
        >
          Review Required
        </Badge>
      </div>

      <div className={cn('mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] font-medium', isLightMode ? 'text-slate-500' : 'text-slate-400')}>
        <span>{formatConfidencePercentage(inspection.confidence_score)}</span>
        <span>{formatOrganLabel(inspection.organ_type)}</span>
        <span>{formatReviewDateTime(inspection.captured_at)}</span>
      </div>
    </button>
  )
}

export default function PendingReviewsDrawer({
  open,
  onClose,
  inspections,
  onSelectInspection,
}) {
  const { mode } = useThemeMode()
  const isLightMode = mode === 'light'
  const count = inspections.length

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
          aria-label="Pending reviews"
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
                ? 'linear-gradient(160deg, rgba(254,243,199,0.92), rgba(255,255,255,0.98))'
                : 'linear-gradient(160deg, rgba(245, 158, 11, 0.22), rgba(6, 15, 13, 0.98))',
              borderBottom: isLightMode ? '1px solid rgba(226,232,240,0.92)' : '1px solid rgba(148, 163, 184, 0.16)',
              flexShrink: 0,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: isLightMode ? '#a16207' : '#FDE68A', lineHeight: 1.1, letterSpacing: 1.4 }}
                  >
                    Review queue
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: isLightMode ? '#0f172a' : '#F8FAFC',
                      fontWeight: 850,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    Pending Reviews
                  </Typography>
                  <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)' }}>
                    Low-confidence inspections waiting for manual review in the Review workspace.
                  </Typography>
                </Stack>
                <DrawerCloseButton
                  onClick={onClose}
                  aria-label="Close pending reviews"
                />
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`${count} pending`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(251,191,36,0.36)', bgcolor: 'rgba(254,243,199,0.92)', color: '#92400e' }
                    : { borderColor: 'rgba(253, 224, 71, 0.28)', color: '#FEF08A' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label="Open in Review page"
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
            {count === 0 ? (
              <div className={cn(
                'flex min-h-[240px] flex-col items-center justify-center rounded-2xl border px-6 py-8 text-center',
                isLightMode
                  ? 'border-dashed border-slate-300 bg-white/80'
                  : 'border-dashed border-white/10 bg-white/[0.02]',
              )}>
                <div className={cn(
                  'mb-3 rounded-full border p-3',
                  isLightMode
                    ? 'border-amber-300/45 bg-amber-100 text-amber-700'
                    : 'border-amber-300/20 bg-amber-400/10 text-amber-200',
                )}>
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <p className={cn('text-base font-semibold', isLightMode ? 'text-slate-900' : 'text-slate-100')}>Review queue is clear</p>
                <p className={cn('mt-2 max-w-sm text-sm', isLightMode ? 'text-slate-500' : 'text-slate-400')}>
                  Low-confidence inspections will appear here when manual review is required.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {inspections.map((inspection) => (
                  <ReviewQueueItem
                    key={inspection.id}
                    inspection={inspection}
                    onSelect={onSelectInspection}
                    isLightMode={isLightMode}
                  />
                ))}
              </div>
            )}
          </Box>
        </Box>
      </Box>
    </Portal>
  )
}
