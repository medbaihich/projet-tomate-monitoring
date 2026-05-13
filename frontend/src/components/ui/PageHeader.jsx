import { Box, Divider, Stack, Typography } from '@mui/material';
import { useThemeMode } from '@/theme-mode-context';

export default function PageHeader({ eyebrow, title, subtitle, actions, withDivider = false }) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const hasSupportingCopy = Boolean(eyebrow || subtitle);

  return (
    <Stack spacing={withDivider ? 0.75 : 0.35}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={hasSupportingCopy ? 1 : 0.75}
      >
        <Stack spacing={hasSupportingCopy ? 0.2 : 0}>
          {eyebrow ? (
            <Typography
              variant="overline"
              color="text.secondary"
              sx={isLightMode ? { fontWeight: 700, letterSpacing: '0.16em', color: '#64748b' } : undefined}
            >
              {eyebrow}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{
                display: { xs: 'none', sm: 'block' },
                width: 6,
                height: 40,
                borderRadius: 999,
                bgcolor: isLightMode ? 'rgba(52, 211, 153, 0.88)' : 'rgba(74, 222, 128, 0.8)',
                boxShadow: isLightMode
                  ? '0 0 18px rgba(16, 185, 129, 0.18)'
                  : '0 0 18px rgba(74, 222, 128, 0.24)',
                flexShrink: 0,
              }}
            />
            <Typography
              component="h1"
              sx={{
                minWidth: 0,
                fontWeight: 600,
                fontSize: 'clamp(1.5rem, 1.3rem + 0.6vw, 1.85rem)',
                letterSpacing: '-0.04em',
                color: isLightMode ? '#020617' : '#f8fafc',
              }}
            >
              {title}
            </Typography>
          </Stack>
          {subtitle ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                maxWidth: 620,
                fontSize: '0.78rem',
                color: isLightMode ? '#64748b' : undefined,
              }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {actions ? (
          <Stack
            direction="row"
            spacing={0.5}
            useFlexGap
            flexWrap="wrap"
            sx={{
              width: { xs: '100%', md: 'auto' },
              justifyContent: { xs: 'flex-start', md: 'flex-end' },
              alignSelf: { xs: 'stretch', md: 'center' },
            }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {withDivider ? <Divider /> : null}
    </Stack>
  );
}
