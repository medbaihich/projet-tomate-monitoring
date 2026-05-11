import { Alert, Chip, Divider, Grid, Stack, Typography } from '@mui/material';

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : 'N/A';
}

function formatRadius(value) {
  if (value === 0) {
    return '0 m';
  }

  return value ? `${value} m` : 'N/A';
}

function ProfileValue({ label, value }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textTransform: value ? 'capitalize' : 'none' }}>
        {value || 'N/A'}
      </Typography>
    </Stack>
  );
}

export default function DiseaseMapProfilePanel({ profile }) {
  if (!profile) {
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Disease Map Profile
        </Typography>
        <Alert severity="info" variant="outlined">
          No map profile configured.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Disease Map Profile
        </Typography>
        <Chip
          size="small"
          color={profile.is_infectious ? 'error' : 'success'}
          variant={profile.is_infectious ? 'filled' : 'outlined'}
          label={profile.is_infectious ? 'Infectious' : 'Non-infectious'}
        />
        <Chip size="small" variant="outlined" label={formatLabel(profile.risk_level)} />
      </Stack>

      <Grid container spacing={1.1}>
        <Grid size={{ xs: 6, md: 4 }}>
          <ProfileValue label="spread_category" value={formatLabel(profile.spread_category)} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <ProfileValue label="transmission_mode" value={formatLabel(profile.transmission_mode)} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <ProfileValue label="zone_type" value={formatLabel(profile.zone_type)} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <ProfileValue label="spread_radius_m" value={formatRadius(profile.spread_radius_m)} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <ProfileValue label="map_label" value={profile.map_label} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <ProfileValue label="active" value={profile.is_active ? 'Active' : 'Inactive'} />
        </Grid>
      </Grid>

      {profile.short_map_description ? (
        <>
          <Divider />
          <Typography variant="body2" color="text.secondary">
            {profile.short_map_description}
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}
