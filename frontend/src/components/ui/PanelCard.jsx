import { Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { useThemeMode } from '@/theme-mode-context';

export default function PanelCard({ title, subtitle, badge, actions, children, minHeight, contentSx }) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';

  return (
    <Card
      sx={{
        height: '100%',
        minHeight,
        borderRadius: 0.75,
        border: '1px solid',
        borderColor: isLightMode ? 'rgba(214,224,215,0.95)' : 'rgba(28,38,36,0.92)',
        backgroundImage: isLightMode
          ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,248,244,0.98))'
          : 'linear-gradient(180deg, rgba(18,26,24,0.98), rgba(12,18,17,0.98))',
        boxShadow: isLightMode
          ? '0 16px 34px rgba(22, 48, 35, 0.06)'
          : '0 18px 42px rgba(0, 0, 0, 0.24)',
      }}
    >
      <CardContent
        sx={{
          p: { xs: 1.25, md: 1.4 },
          '&:last-child': {
            pb: { xs: 1.25, md: 1.4 },
          },
          ...contentSx,
        }}
      >
        <Stack spacing={1} sx={{ height: '100%' }}>
          {(title || subtitle || badge || actions) ? (
            <Stack spacing={0.7}>
              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                    {title ? (
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.92rem', color: isLightMode ? '#0f172a' : '#f8fafc' }}>
                        {title}
                      </Typography>
                    ) : null}
                    {badge ? (
                      <Chip
                        size="small"
                        label={badge}
                        variant="outlined"
                        sx={isLightMode
                          ? {
                              borderColor: 'rgba(34,197,94,0.18)',
                              backgroundColor: 'rgba(220,252,231,0.72)',
                              color: '#166534',
                            }
                          : {
                              borderColor: 'rgba(255,255,255,0.12)',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              color: '#d1fae5',
                            }}
                      />
                    ) : null}
                  </Stack>
                  {subtitle ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '0.76rem', color: isLightMode ? '#64748b' : '#94a3b8' }}
                    >
                      {subtitle}
                    </Typography>
                  ) : null}
                </Stack>
                {actions}
              </Stack>
              <Divider sx={{ borderColor: isLightMode ? 'rgba(226,232,240,0.9)' : 'rgba(255,255,255,0.08)' }} />
            </Stack>
          ) : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
