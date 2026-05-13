import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useThemeMode } from '@/theme-mode-context';

function toFieldErrorMap(error) {
  const payload = error?.response?.data;
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return {};
  }

  return Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (Array.isArray(value)) {
      accumulator[key] = value.join(' ');
    } else if (typeof value === 'string') {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function resolveErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data;

  if (typeof payload?.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

export default function CreateDeviceDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  lines,
  initialLineId,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const [form, setForm] = useState({
    line: initialLineId || lines[0]?.id || '',
    name: '',
    identifier: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');

  const canSubmit = useMemo(
    () => Boolean(form.line && form.name.trim() && form.identifier.trim()),
    [form.identifier, form.line, form.name],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setNotice('');

    try {
      await onSubmit({
        line: form.line,
        name: form.name.trim(),
        identifier: form.identifier.trim(),
        description: form.description.trim(),
      });
    } catch (error) {
      setErrors(toFieldErrorMap(error));
      setNotice(resolveErrorMessage(error, 'Unable to create the device.'));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: isLightMode
          ? {
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(244,248,244,0.98))',
              border: '1px solid rgba(214,224,215,0.95)',
              boxShadow: '0 20px 44px rgba(15,23,42,0.14)',
            }
          : undefined,
      }}
    >
      <DialogTitle sx={isLightMode ? { color: '#0f172a', fontWeight: 800 } : undefined}>Create device</DialogTitle>
      <DialogContent dividers sx={isLightMode ? { borderColor: 'rgba(226,232,240,0.92)' } : undefined}>
        <Stack spacing={1.5} component="form" onSubmit={handleSubmit} id="create-device-form">
          <Typography variant="body2" color="text.secondary" sx={isLightMode ? { color: '#64748b' } : undefined}>
            Register a new operational device directly inside Smart Eye and attach it to an existing line.
          </Typography>

          {notice ? <Alert severity="error">{notice}</Alert> : null}

          {lines.length === 0 ? (
            <Alert severity="warning">
              A device needs an existing line first. No lines are currently available in the loaded hierarchy.
            </Alert>
          ) : null}

          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                required
                label="Line"
                name="line"
                value={form.line}
                onChange={handleChange}
                error={Boolean(errors.line)}
                helperText={errors.line || ' '}
                disabled={isSubmitting || lines.length === 0}
              >
                {lines.map((line) => (
                  <MenuItem key={line.id} value={line.id}>
                    {line.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                autoFocus={lines.length > 0}
                required
                label="Device name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={Boolean(errors.name)}
                helperText={errors.name || ' '}
                disabled={isSubmitting || lines.length === 0}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Identifier"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                error={Boolean(errors.identifier)}
                helperText={errors.identifier || ' '}
                disabled={isSubmitting || lines.length === 0}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Description"
                name="description"
                value={form.description}
                onChange={handleChange}
                error={Boolean(errors.description)}
                helperText={errors.description || ' '}
                disabled={isSubmitting || lines.length === 0}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={isLightMode ? { px: 3, py: 1.5, borderTop: '1px solid rgba(226,232,240,0.92)', bgcolor: 'rgba(248,250,252,0.72)' } : { px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-device-form"
          variant="contained"
          disabled={!canSubmit || isSubmitting || lines.length === 0}
        >
          {isSubmitting ? 'Creating...' : 'Create device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
