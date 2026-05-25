import { useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  Card,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import BrokenImageRoundedIcon from '@mui/icons-material/BrokenImageRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import StatusChip from '@/components/ui/StatusChip';
import { useThemeMode } from '@/theme-mode-context';

function formatEvidenceReason(reason) {
  if (!reason) {
    return null;
  }

  return String(reason)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatusLabel(status) {
  if (!status) {
    return null;
  }

  return String(status)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveStatusTone(status) {
  switch (status) {
    case 'uploaded':
      return 'completed';
    case 'pending':
      return 'pending';
    case 'failed':
    case 'expired':
    case 'not_found':
      return 'failed';
    default:
      return 'neutral';
  }
}

function resolveEvidenceState({ imageUrl, requestStatus, imageStatus }) {
  if (imageUrl) {
    return 'available';
  }

  if (requestStatus === 'pending') {
    return 'pending';
  }

  if (['failed', 'expired', 'not_found'].includes(requestStatus)) {
    return 'failed';
  }

  if (imageStatus === 'uploaded' || requestStatus === 'uploaded') {
    return 'uploaded_without_preview';
  }

  return 'empty';
}

function resolveEvidenceImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') {
    return '';
  }

  const trimmed = imageUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (
    trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('data:')
    || trimmed.startsWith('blob:')
    || trimmed.startsWith('//')
  ) {
    return trimmed;
  }

  if (typeof window === 'undefined') {
    return trimmed;
  }

  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
}

function StateFrame({ icon, title, message, chips, isLightMode, tone = 'neutral' }) {
  const palette = tone === 'warning'
    ? {
        background: isLightMode ? 'rgba(255, 251, 235, 0.92)' : 'rgba(120, 53, 15, 0.16)',
        border: isLightMode ? 'rgba(251, 191, 36, 0.34)' : 'rgba(251, 191, 36, 0.22)',
        iconBackground: isLightMode ? 'rgba(254, 243, 199, 0.92)' : 'rgba(251, 191, 36, 0.14)',
        iconColor: isLightMode ? '#92400e' : '#FDE68A',
      }
    : {
        background: isLightMode ? 'rgba(248, 250, 252, 0.92)' : 'rgba(255, 255, 255, 0.04)',
        border: isLightMode ? 'rgba(203, 213, 225, 0.92)' : 'rgba(148, 163, 184, 0.16)',
        iconBackground: isLightMode ? 'rgba(226, 232, 240, 0.88)' : 'rgba(148, 163, 184, 0.12)',
        iconColor: isLightMode ? '#475569' : 'rgba(226, 232, 240, 0.92)',
      };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: palette.border,
        bgcolor: palette.background,
        boxShadow: isLightMode ? '0 10px 24px rgba(15,23,42,0.04)' : 'none',
      }}
    >
      <Stack spacing={1.15} sx={{ p: 1.3 }}>
        <Stack direction="row" spacing={1.05} alignItems="flex-start">
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: palette.iconBackground,
              color: palette.iconColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>
          </Stack>
        </Stack>

        {chips?.length ? (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {chips}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

export default function EvidenceImagePreview({
  imageUrl,
  requestStatus,
  imageStatus,
  requestReason,
  title = 'Evidence image',
  showEmptyState = false,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const resolvedImageUrl = useMemo(() => resolveEvidenceImageUrl(imageUrl), [imageUrl]);
  const evidenceState = resolveEvidenceState({
    imageUrl: resolvedImageUrl,
    requestStatus,
    imageStatus,
  });
  const reasonLabel = formatEvidenceReason(requestReason);
  const statusLabel = formatStatusLabel(
    evidenceState === 'available'
      ? imageStatus || requestStatus || 'uploaded'
      : requestStatus || imageStatus,
  );

  if (evidenceState === 'empty' && !showEmptyState) {
    return null;
  }

  if (evidenceState === 'pending') {
    return (
      <StateFrame
        icon={<HourglassTopRoundedIcon fontSize="small" />}
        title={title}
        message="Evidence image requested from edge device. Waiting for Raspberry upload."
        tone="neutral"
        isLightMode={isLightMode}
        chips={[
          <StatusChip key="status" size="small" tone="pending" label={statusLabel || 'Pending'} />,
          reasonLabel ? <Chip key="reason" size="small" variant="outlined" label={reasonLabel} /> : null,
        ].filter(Boolean)}
      />
    );
  }

  if (evidenceState === 'failed') {
    return (
      <StateFrame
        icon={<ReportProblemRoundedIcon fontSize="small" />}
        title={title}
        message="The platform could not retrieve the edge evidence image for this inspection."
        tone="warning"
        isLightMode={isLightMode}
        chips={[
          <StatusChip
            key="status"
            size="small"
            tone={resolveStatusTone(requestStatus)}
            label={statusLabel || 'Unavailable'}
          />,
          reasonLabel ? <Chip key="reason" size="small" variant="outlined" label={reasonLabel} /> : null,
        ].filter(Boolean)}
      />
    );
  }

  if (evidenceState === 'uploaded_without_preview') {
    return (
      <StateFrame
        icon={<BrokenImageRoundedIcon fontSize="small" />}
        title={title}
        message="Evidence image upload completed, but a preview URL is not currently available."
        tone="neutral"
        isLightMode={isLightMode}
        chips={[
          <StatusChip
            key="status"
            size="small"
            tone={resolveStatusTone(imageStatus || requestStatus)}
            label={statusLabel || 'Uploaded'}
          />,
          reasonLabel ? <Chip key="reason" size="small" variant="outlined" label={reasonLabel} /> : null,
        ].filter(Boolean)}
      />
    );
  }

  if (evidenceState !== 'available') {
    return null;
  }

  return (
    <>
      <ButtonBase
        onClick={() => setIsPreviewOpen(true)}
        aria-label={`Open ${title.toLowerCase()} preview`}
        sx={{
          display: 'block',
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          textAlign: 'left',
        }}
      >
        <Card
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            borderColor: isLightMode ? 'rgba(203, 213, 225, 0.92)' : 'rgba(148, 163, 184, 0.16)',
            bgcolor: isLightMode ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.03)',
            boxShadow: isLightMode ? '0 14px 30px rgba(15,23,42,0.06)' : 'none',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              bgcolor: isLightMode ? 'rgba(241, 245, 249, 0.92)' : 'rgba(2, 6, 23, 0.65)',
            }}
          >
            <Box
              component="img"
              src={resolvedImageUrl}
              alt={title}
              sx={{
                display: 'block',
                width: '100%',
                minHeight: 180,
                maxHeight: 260,
                objectFit: 'contain',
                objectPosition: 'center',
                bgcolor: 'transparent',
              }}
            />

            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              flexWrap="wrap"
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
              }}
            >
              <Chip
                size="small"
                icon={<ImageRoundedIcon />}
                label={title}
                sx={{
                  bgcolor: 'rgba(15, 23, 42, 0.76)',
                  color: '#F8FAFC',
                  '& .MuiChip-icon': { color: '#F8FAFC' },
                }}
              />
              <StatusChip
                size="small"
                tone={resolveStatusTone(imageStatus || requestStatus || 'uploaded')}
                label={statusLabel || 'Uploaded'}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.88)',
                }}
              />
              {reasonLabel ? (
                <Chip
                  size="small"
                  label={reasonLabel}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.88)',
                  }}
                />
              ) : null}
            </Stack>
          </Box>

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            sx={{ px: 1.25, py: 1 }}
          >
            <Typography variant="body2" color="text.secondary">
              Click to open a larger preview.
            </Typography>
            <OpenInFullRoundedIcon fontSize="small" color="action" />
          </Stack>
        </Card>
      </ButtonBase>

      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fullWidth
        maxWidth="lg"
        aria-label={`${title} preview dialog`}
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: isLightMode ? 'rgba(248, 250, 252, 0.98)' : 'rgba(3, 7, 18, 0.96)',
            backgroundImage: 'none',
            borderRadius: 2,
            overflow: 'hidden',
          },
        }}
      >
        <DialogContent
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            position: 'relative',
          }}
        >
          <IconButton
            onClick={() => setIsPreviewOpen(false)}
            aria-label="Close evidence image preview"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1,
              bgcolor: isLightMode ? 'rgba(255,255,255,0.86)' : 'rgba(15, 23, 42, 0.76)',
              border: '1px solid',
              borderColor: isLightMode ? 'rgba(203, 213, 225, 0.92)' : 'rgba(148, 163, 184, 0.18)',
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>

          <Stack spacing={1.1}>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                icon={<ImageRoundedIcon />}
                label={title}
              />
              <StatusChip
                size="small"
                tone={resolveStatusTone(imageStatus || requestStatus || 'uploaded')}
                label={statusLabel || 'Uploaded'}
              />
              {reasonLabel ? <Chip size="small" variant="outlined" label={reasonLabel} /> : null}
            </Stack>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: { xs: 260, sm: 420 },
                maxHeight: 'calc(100vh - 180px)',
                borderRadius: 1.6,
                overflow: 'hidden',
                bgcolor: isLightMode ? 'rgba(241, 245, 249, 0.92)' : 'rgba(2, 6, 23, 0.72)',
                border: '1px solid',
                borderColor: isLightMode ? 'rgba(226, 232, 240, 0.92)' : 'rgba(148, 163, 184, 0.14)',
              }}
            >
              <Box
                component="img"
                src={resolvedImageUrl}
                alt={title}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: 'calc(100vh - 180px)',
                  objectFit: 'contain',
                }}
              />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
