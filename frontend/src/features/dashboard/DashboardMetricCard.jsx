import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';

export default function DashboardMetricCard({
  title,
  value,
  helper,
  accent = 'primary',
  chipLabel,
  trendLabel,
  footerLabel,
}) {
  const accentStyles = {
    primary: { bar: '#1F6A3D', tint: 'rgba(31, 106, 61, 0.06)' },
    info: { bar: '#5E8F63', tint: 'rgba(94, 143, 99, 0.08)' },
    secondary: { bar: '#124B2F', tint: 'rgba(18, 75, 47, 0.06)' },
    warning: { bar: '#F2B233', tint: 'rgba(242, 178, 51, 0.12)' },
    alert: { bar: '#D32F2F', tint: 'rgba(211, 47, 47, 0.1)' },
    success: { bar: '#1F6A3D', tint: 'rgba(31, 106, 61, 0.06)' },
  };
  const selectedAccent = accentStyles[accent] ?? accentStyles.primary;

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        borderRadius: 0.75,
        boxShadow: '0 3px 10px rgba(18, 75, 47, 0.045)',
        backgroundImage: `linear-gradient(180deg, ${selectedAccent.tint} 0%, rgba(255, 255, 255, 0) 38%)`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          bgcolor: selectedAccent.bar,
        }}
      />
      <CardContent sx={{ p: 1.05, '&:last-child': { pb: 1.05 } }}>
        <Stack spacing={0.8}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack spacing={0.5}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ letterSpacing: '0.12em', fontWeight: 600, fontSize: '0.62rem' }}
              >
                {title}
              </Typography>
              <Box
                sx={{
                  width: 22,
                  height: 1,
                  bgcolor: alpha(selectedAccent.bar, 0.28),
                }}
              />
            </Stack>
            {chipLabel ? (
              <Chip
                size="small"
                label={chipLabel}
                variant="outlined"
                sx={{
                  borderColor: alpha(selectedAccent.bar, 0.18),
                  bgcolor: alpha(selectedAccent.bar, 0.03),
                  color: accent === 'warning'
                    ? 'warning.dark'
                    : accent === 'alert'
                      ? 'error.dark'
                      : 'text.secondary',
                  borderRadius: 1,
                }}
              />
            ) : null}
          </Stack>
          <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={1}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                fontSize: 'clamp(1.14rem, 1rem + 0.52vw, 1.4rem)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </Typography>
            {trendLabel ? (
              <Chip
                size="small"
                variant="outlined"
                label={trendLabel}
                sx={{
                  bgcolor: 'background.paper',
                  color: 'text.secondary',
                  borderColor: alpha(selectedAccent.bar, 0.16),
                  borderRadius: 1,
                }}
              />
            ) : null}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, fontSize: '0.7rem' }}>
            {helper}
          </Typography>
          {footerLabel ? (
            <>
              <Divider sx={{ my: 0.25 }} />
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.01em', fontWeight: 500 }}>
                {footerLabel}
              </Typography>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
