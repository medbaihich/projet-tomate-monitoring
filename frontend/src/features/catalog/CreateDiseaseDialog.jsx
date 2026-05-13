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

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeAiLabel(value) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildDiseaseSlug(organType, name) {
  const baseSlug = slugify(name);
  return baseSlug ? `${organType}-${baseSlug}` : '';
}

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

const INITIAL_FORM = {
  name: '',
  slug: '',
  organ_type: 'fruit',
  ai_label: '',
  summary: '',
  symptoms: '',
  prevention: '',
};

export default function CreateDiseaseDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isAiLabelManuallyEdited, setIsAiLabelManuallyEdited] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(
      form.name.trim()
      && form.slug.trim()
      && form.organ_type
      && form.ai_label.trim(),
    ),
    [form.ai_label, form.name, form.organ_type, form.slug],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentState) => {
      if (name === 'name') {
        return {
          ...currentState,
          name: value,
          slug: isSlugManuallyEdited
            ? currentState.slug
            : buildDiseaseSlug(currentState.organ_type, value),
          ai_label: isAiLabelManuallyEdited ? currentState.ai_label : normalizeAiLabel(value),
        };
      }

      if (name === 'organ_type') {
        return {
          ...currentState,
          organ_type: value,
          slug: isSlugManuallyEdited
            ? currentState.slug
            : buildDiseaseSlug(value, currentState.name),
        };
      }

      if (name === 'slug') {
        setIsSlugManuallyEdited(true);
      }

      if (name === 'ai_label') {
        setIsAiLabelManuallyEdited(true);
      }

      return {
        ...currentState,
        [name]: name === 'ai_label' ? normalizeAiLabel(value) : value,
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setNotice('');

    try {
      await onSubmit({
        name: form.name.trim(),
        slug: form.slug.trim(),
        organ_type: form.organ_type,
        ai_label: normalizeAiLabel(form.ai_label),
        summary: form.summary.trim(),
        symptoms: form.symptoms.trim(),
        prevention: form.prevention.trim(),
      });
    } catch (error) {
      setErrors(toFieldErrorMap(error));
      setNotice(resolveErrorMessage(error, 'Unable to create the disease.'));
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
      <DialogTitle sx={isLightMode ? { color: '#0f172a', fontWeight: 800 } : undefined}>Create disease</DialogTitle>
      <DialogContent dividers sx={isLightMode ? { borderColor: 'rgba(226,232,240,0.92)' } : undefined}>
        <Stack spacing={1.5} component="form" onSubmit={handleSubmit} id="create-disease-form">
          <Typography variant="body2" color="text.secondary" sx={isLightMode ? { color: '#64748b' } : undefined}>
            Add a new disease record directly inside Smart Eye. Related causes, treatments, and resources can still be enriched later.
          </Typography>

          {notice ? <Alert severity="error">{notice}</Alert> : null}

          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                autoFocus
                required
                label="Disease name"
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
                select
                label="Organ type"
                name="organ_type"
                value={form.organ_type}
                onChange={handleChange}
                error={Boolean(errors.organ_type)}
                helperText={errors.organ_type || ' '}
                disabled={isSubmitting}
              >
                <MenuItem value="fruit">Fruit</MenuItem>
                <MenuItem value="leaf">Leaf</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="AI label"
                name="ai_label"
                value={form.ai_label}
                onChange={handleChange}
                error={Boolean(errors.ai_label)}
                helperText={errors.ai_label || ' '}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Slug"
                name="slug"
                value={form.slug}
                onChange={handleChange}
                error={Boolean(errors.slug)}
                helperText={errors.slug || ' '}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Summary"
                name="summary"
                value={form.summary}
                onChange={handleChange}
                error={Boolean(errors.summary)}
                helperText={errors.summary || ' '}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Symptoms"
                name="symptoms"
                value={form.symptoms}
                onChange={handleChange}
                error={Boolean(errors.symptoms)}
                helperText={errors.symptoms || ' '}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Prevention"
                name="prevention"
                value={form.prevention}
                onChange={handleChange}
                error={Boolean(errors.prevention)}
                helperText={errors.prevention || ' '}
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
          form="create-disease-form"
          variant="contained"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create disease'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
