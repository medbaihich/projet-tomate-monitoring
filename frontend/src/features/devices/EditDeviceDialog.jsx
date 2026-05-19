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
import {
  resolveErrorMessage,
  toFieldErrorMap,
  toOptionalNumber,
} from '@/features/devices/deviceFormUtils';

function toEditableString(value) {
  return value === null || value === undefined ? '' : String(value);
}

function buildFormState(device, fallbackLineId) {
  return {
    line: device?.line || fallbackLineId || '',
    name: device?.name || '',
    identifier: device?.identifier || '',
    description: device?.description || '',
    latitude: toEditableString(device?.latitude),
    longitude: toEditableString(device?.longitude),
    local_x: toEditableString(device?.local_x),
    local_y: toEditableString(device?.local_y),
    map_label: device?.map_label || '',
  };
}

export default function EditDeviceDialog({
  open,
  device,
  onClose,
  onSubmit,
  isSubmitting,
  lines,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const [form, setForm] = useState(() => buildFormState(device, lines[0]?.id));
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
        id: device.id,
        line: form.line,
        name: form.name.trim(),
        identifier: form.identifier.trim(),
        description: form.description.trim(),
        latitude: toOptionalNumber(form.latitude),
        longitude: toOptionalNumber(form.longitude),
        local_x: toOptionalNumber(form.local_x),
        local_y: toOptionalNumber(form.local_y),
        map_label: form.map_label.trim(),
      });
    } catch (error) {
      setErrors(toFieldErrorMap(error));
      setNotice(resolveErrorMessage(error, 'Unable to update the device.'));
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
      <DialogTitle sx={isLightMode ? { color: '#0f172a', fontWeight: 800 } : undefined}>Edit device</DialogTitle>
      <DialogContent dividers sx={isLightMode ? { borderColor: 'rgba(226,232,240,0.92)' } : undefined}>
        <Stack spacing={1.5} component="form" onSubmit={handleSubmit} id="edit-device-form">
          <Typography variant="body2" color="text.secondary" sx={isLightMode ? { color: '#64748b' } : undefined}>
            Update device identity, hierarchy placement, and optional map fields without leaving the registry.
          </Typography>

          {notice ? <Alert severity="error">{notice}</Alert> : null}

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
                autoFocus
                required
                label="Device name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={Boolean(errors.name)}
                helperText={errors.name || ' '}
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Latitude"
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                error={Boolean(errors.latitude)}
                helperText={errors.latitude || ' '}
                disabled={isSubmitting}
                slotProps={{ htmlInput: { step: 'any' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Longitude"
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                error={Boolean(errors.longitude)}
                helperText={errors.longitude || ' '}
                disabled={isSubmitting}
                slotProps={{ htmlInput: { step: 'any' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Local X"
                name="local_x"
                value={form.local_x}
                onChange={handleChange}
                error={Boolean(errors.local_x)}
                helperText={errors.local_x || ' '}
                disabled={isSubmitting}
                slotProps={{ htmlInput: { step: 'any' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Local Y"
                name="local_y"
                value={form.local_y}
                onChange={handleChange}
                error={Boolean(errors.local_y)}
                helperText={errors.local_y || ' '}
                disabled={isSubmitting}
                slotProps={{ htmlInput: { step: 'any' } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Map label"
                name="map_label"
                value={form.map_label}
                onChange={handleChange}
                error={Boolean(errors.map_label)}
                helperText={errors.map_label || ' '}
                disabled={isSubmitting}
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
          form="edit-device-form"
          variant="contained"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
