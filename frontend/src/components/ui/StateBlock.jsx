import { Box, Button, Stack, Typography } from '@mui/material';
import { useThemeMode } from '@/theme-mode-context';

export default function StateBlock({
  title,
  message,
  actionLabel,
  onAction,
  minHeight = 170,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        border: '1px dashed',
        borderColor: isLightMode ? 'rgba(203,213,225,0.95)' : 'divider',
        borderRadius: 1.25,
        bgcolor: isLightMode ? 'rgba(255,255,255,0.72)' : 'background.default',
        boxShadow: isLightMode ? '0 10px 24px rgba(15,23,42,0.04)' : 'none',
        px: 1.5,
        py: 2,
      }}
    >
      <Stack spacing={0.6} alignItems="center" textAlign="center" sx={{ maxWidth: 300 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.84rem' }}>
          {message}
        </Typography>
        {actionLabel && onAction ? (
          <Button variant="outlined" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
