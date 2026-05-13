import { IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useThemeMode } from '@/theme-mode-context';

export default function DrawerCloseButton({ onClick, ariaLabel, sx }) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';

  return (
    <IconButton
      onClick={onClick}
      aria-label={ariaLabel}
      size="small"
      sx={{
        width: 34,
        height: 34,
        borderRadius: 999,
        color: isLightMode ? '#334155' : '#E2E8F0',
        border: '1px solid',
        borderColor: isLightMode ? 'rgba(203,213,225,0.9)' : 'rgba(255, 255, 255, 0.1)',
        bgcolor: isLightMode ? 'rgba(255,255,255,0.72)' : 'rgba(255, 255, 255, 0.03)',
        boxShadow: isLightMode ? '0 4px 12px rgba(15,23,42,0.04)' : 'none',
        '&:hover': {
          borderColor: isLightMode ? 'rgba(148,163,184,0.42)' : 'rgba(255, 255, 255, 0.16)',
          bgcolor: isLightMode ? 'rgba(248,250,252,0.94)' : 'rgba(255, 255, 255, 0.07)',
        },
        ...sx,
      }}
    >
      <CloseRoundedIcon sx={{ fontSize: 18 }} />
    </IconButton>
  );
}
