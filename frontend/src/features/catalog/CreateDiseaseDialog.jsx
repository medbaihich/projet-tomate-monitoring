import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(form.name.trim() && form.slug.trim()),
    [form.name, form.slug],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentState) => {
      if (name === 'name') {
        return {
          ...currentState,
          name: value,
          slug: isSlugManuallyEdited ? currentState.slug : slugify(value),
        };
      }

      if (name === 'slug') {
        setIsSlugManuallyEdited(true);
      }

      return {
        ...currentState,
        [name]: value,
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
    >
      <DialogTitle>Create disease</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} component="form" onSubmit={handleSubmit} id="create-disease-form">
          <Typography variant="body2" color="text.secondary">
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
      <DialogActions sx={{ px: 3, py: 1.5 }}>
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
