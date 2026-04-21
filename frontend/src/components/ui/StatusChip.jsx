import { Chip } from '@mui/material';

const STATUS_STYLES = {
  healthy: { color: 'success', variant: 'filled' },
  stable: { color: 'success', variant: 'outlined' },
  pending: { color: 'warning', variant: 'filled' },
  review: { color: 'warning', variant: 'outlined' },
  attention: { color: 'warning', variant: 'filled' },
  alert: { color: 'error', variant: 'filled' },
  critical: { color: 'error', variant: 'filled' },
  failed: { color: 'error', variant: 'filled' },
  rejected: { color: 'error', variant: 'outlined' },
  corrected: { color: 'warning', variant: 'outlined' },
  completed: { color: 'success', variant: 'filled' },
  reviewed: { color: 'success', variant: 'outlined' },
  new: { color: 'info', variant: 'outlined' },
  processing: { color: 'info', variant: 'filled' },
  inactive: { color: 'default', variant: 'outlined' },
  neutral: { color: 'default', variant: 'outlined' },
  unknown: { color: 'default', variant: 'outlined' },
};

export default function StatusChip({ tone = 'neutral', label, size = 'small', ...props }) {
  const config = STATUS_STYLES[tone] ?? STATUS_STYLES.neutral;

  return (
    <Chip
      size={size}
      color={config.color}
      variant={config.variant}
      label={label}
      sx={{
        textTransform: 'capitalize',
        letterSpacing: '0.01em',
        height: size === 'small' ? 20 : undefined,
        '& .MuiChip-label': {
          px: size === 'small' ? 0.8 : undefined,
          fontSize: size === 'small' ? '0.7rem' : undefined,
        },
      }}
      {...props}
    />
  );
}
