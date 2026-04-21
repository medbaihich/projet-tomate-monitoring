import { Divider, Stack, Typography } from '@mui/material';

export default function PageHeader({ eyebrow, title, subtitle, actions, withDivider = false }) {
  return (
    <Stack spacing={0.75}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        spacing={1}
      >
        <Stack spacing={0.2}>
          {eyebrow ? (
            <Typography variant="overline" color="text.secondary">
              {eyebrow}
            </Typography>
          ) : null}
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, fontSize: 'clamp(1.18rem, 1.04rem + 0.55vw, 1.5rem)' }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620, fontSize: '0.78rem' }}>
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {actions ? <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{actions}</Stack> : null}
      </Stack>
      {withDivider ? <Divider /> : null}
    </Stack>
  );
}
