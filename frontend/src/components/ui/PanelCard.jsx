import { Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';

export default function PanelCard({ title, subtitle, badge, actions, children, minHeight, contentSx }) {
  return (
    <Card
      sx={{
        height: '100%',
        bgcolor: 'background.paper',
        minHeight,
        borderRadius: 0.75,
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
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
                        {title}
                      </Typography>
                    ) : null}
                    {badge ? <Chip size="small" label={badge} variant="outlined" /> : null}
                  </Stack>
                  {subtitle ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.76rem' }}>
                      {subtitle}
                    </Typography>
                  ) : null}
                </Stack>
                {actions}
              </Stack>
              <Divider />
            </Stack>
          ) : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
