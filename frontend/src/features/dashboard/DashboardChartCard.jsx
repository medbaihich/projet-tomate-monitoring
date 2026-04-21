import { Box, Skeleton, Stack } from '@mui/material';
import PanelCard from '@/components/ui/PanelCard';

export default function DashboardChartCard({
  title,
  subtitle,
  children,
  loading = false,
  minHeight = 194,
  badgeLabel,
  action,
}) {
  return (
    <PanelCard
      title={title}
      subtitle={subtitle}
      badge={badgeLabel}
      actions={action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      minHeight={minHeight}
      contentSx={{
        p: { xs: 0.9, md: 1 },
        '&:last-child': {
          pb: { xs: 0.9, md: 1 },
        },
      }}
    >
      {loading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton width="60%" />
        </Stack>
      ) : children}
    </PanelCard>
  );
}
