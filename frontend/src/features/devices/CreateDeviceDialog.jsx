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
  zones,
  initialZoneId,
}) {
  const [form, setForm] = useState({
    zone: initialZoneId || zones[0]?.id || '',
    name: '',
    identifier: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');

  const canSubmit = useMemo(
    () => Boolean(form.zone && form.name.trim() && form.identifier.trim()),
    [form.identifier, form.name, form.zone],
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
        zone: form.zone,
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
    >
      <DialogTitle>Create device</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} component="form" onSubmit={handleSubmit} id="create-device-form">
          <Typography variant="body2" color="text.secondary">
            Register a new operational device directly inside Smart Eye and attach it to an existing zone.
          </Typography>

          {notice ? <Alert severity="error">{notice}</Alert> : null}

          {zones.length === 0 ? (
            <Alert severity="warning">
              A device needs an existing zone first. No zones are currently available in the loaded hierarchy.
            </Alert>
          ) : null}

          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                required
                label="Zone"
                name="zone"
                value={form.zone}
                onChange={handleChange}
                error={Boolean(errors.zone)}
                helperText={errors.zone || ' '}
                disabled={isSubmitting || zones.length === 0}
              >
                {zones.map((zone) => (
                  <MenuItem key={zone.id} value={zone.id}>
                    {zone.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                autoFocus={zones.length > 0}
                required
                label="Device name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={Boolean(errors.name)}
                helperText={errors.name || ' '}
                disabled={isSubmitting || zones.length === 0}
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
                disabled={isSubmitting || zones.length === 0}
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
                disabled={isSubmitting || zones.length === 0}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-device-form"
          variant="contained"
          disabled={!canSubmit || isSubmitting || zones.length === 0}
        >
          {isSubmitting ? 'Creating...' : 'Create device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
