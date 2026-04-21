import { Box, Button, Stack, Typography } from '@mui/material';

export default function StateBlock({
  title,
  message,
  actionLabel,
  onAction,
  minHeight = 170,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1.25,
        bgcolor: 'background.default',
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
