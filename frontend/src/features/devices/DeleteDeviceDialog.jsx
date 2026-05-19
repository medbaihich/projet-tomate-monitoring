import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useThemeMode } from '@/theme-mode-context';

export default function DeleteDeviceDialog({
  open,
  device,
  notice,
  isSubmitting,
  onClose,
  onConfirm,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: isLightMode
          ? {
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,245,245,0.98))',
              border: '1px solid rgba(214,224,215,0.95)',
              boxShadow: '0 20px 44px rgba(15,23,42,0.14)',
            }
          : undefined,
      }}
    >
      <DialogTitle sx={isLightMode ? { color: '#0f172a', fontWeight: 800 } : undefined}>Delete device</DialogTitle>
      <DialogContent dividers sx={isLightMode ? { borderColor: 'rgba(226,232,240,0.92)' } : undefined}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary" sx={isLightMode ? { color: '#64748b' } : undefined}>
            This will permanently remove the device from the registry.
          </Typography>

          {notice ? <Alert severity="error">{notice}</Alert> : null}

          <Alert severity="warning">
            Delete <strong>{device?.name || 'this device'}</strong>
            {device?.identifier ? ` (${device.identifier})` : ''}?
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={isLightMode ? { px: 3, py: 1.5, borderTop: '1px solid rgba(226,232,240,0.92)', bgcolor: 'rgba(248,250,252,0.72)' } : { px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Deleting...' : 'Delete device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
