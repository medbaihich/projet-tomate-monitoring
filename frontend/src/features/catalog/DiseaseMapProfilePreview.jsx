import { Box, Chip, Stack, Typography } from '@mui/material';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import {
  formatDiseaseMapLabel,
  formatDiseaseMapRadius,
  getDiseaseMapProfileRadiusValue,
  hasDiseaseMapConfiguredZone,
  resolveDiseaseMapProfileColor,
  scaleDiseaseMapBubbleSize,
} from '@/features/catalog/diseaseMapProfileUtils';

function SummaryChip({ label, isLightMode, sx }) {
  return (
    <Chip
      size="small"
      label={label}
      variant="outlined"
      sx={{
        maxWidth: '100%',
        height: 'auto',
        '& .MuiChip-label': {
          display: 'block',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          py: 0.55,
        },
        ...(isLightMode
          ? {
              borderColor: 'rgba(203,213,225,0.95)',
              bgcolor: 'rgba(255,255,255,0.82)',
              color: '#475569',
            }
          : {
              borderColor: 'rgba(148, 163, 184, 0.28)',
              color: '#CBD5E1',
            }),
        ...sx,
      }}
    />
  );
}

export default function DiseaseMapProfilePreview({
  disease,
  isLightMode,
}) {
  const profile = disease?.map_profile || null;
  const radius = getDiseaseMapProfileRadiusValue(profile);
  const hasConfiguredZone = hasDiseaseMapConfiguredZone(profile);
  const color = resolveDiseaseMapProfileColor(profile);
  const bubbleSize = scaleDiseaseMapBubbleSize(radius, radius || 1);
  const previewTitle = !profile
    ? 'No map profile configured'
    : hasConfiguredZone
      ? 'Configured spread area'
      : 'No active spread area configured';
  const bubbleBorderStyle = !profile || !hasConfiguredZone ? 'dashed' : 'solid';
  const bubbleOpacity = !profile || !hasConfiguredZone ? 0.72 : 1;
  const bubbleFill = !profile || !hasConfiguredZone ? `${color}14` : `${color}22`;
  const bubbleShadow = !profile || !hasConfiguredZone ? 'none' : `0 0 0 14px ${color}12`;
  const infectiousChipSx = profile?.is_infectious
    ? isLightMode
      ? {
          borderColor: 'rgba(248, 113, 113, 0.22)',
          bgcolor: 'rgba(254,242,242,0.9)',
          color: '#b91c1c',
        }
      : {
          borderColor: 'rgba(248, 113, 113, 0.32)',
          color: '#FECACA',
        }
    : isLightMode
      ? {
          borderColor: 'rgba(34,197,94,0.22)',
          bgcolor: 'rgba(220,252,231,0.78)',
          color: '#166534',
        }
      : {
          borderColor: 'rgba(134, 239, 172, 0.32)',
          color: '#BBF7D0',
        };

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148, 163, 184, 0.12)',
        bgcolor: isLightMode ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.03)',
        px: { xs: 1.1, sm: 1.25 },
        py: { xs: 1.15, sm: 1.25 },
      }}
    >
      <Stack spacing={1.2}>
        <Stack spacing={0.45}>
          <Typography variant="subtitle2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 800 }}>
            {previewTitle}
          </Typography>
        </Stack>

        <Box
          sx={{
            minHeight: 200,
            borderRadius: 1.5,
            border: isLightMode ? '1px solid rgba(226,232,240,0.92)' : '1px solid rgba(148, 163, 184, 0.14)',
            background: isLightMode
              ? 'linear-gradient(180deg, rgba(248,250,252,0.92), rgba(241,245,249,0.7))'
              : 'linear-gradient(180deg, rgba(15,23,42,0.36), rgba(2,6,23,0.18))',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: isLightMode
                ? 'radial-gradient(circle at center, rgba(148,163,184,0.12) 1px, transparent 1px)'
                : 'radial-gradient(circle at center, rgba(148,163,184,0.1) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              opacity: 0.55,
            }}
          />
          <Stack spacing={1.1} alignItems="center" sx={{ position: 'relative', zIndex: 1, px: 2 }}>
            <Box sx={{ position: 'relative', width: 148, height: 148, display: 'grid', placeItems: 'center' }}>
              <Box
                sx={{
                  width: bubbleSize,
                  height: bubbleSize,
                  borderRadius: 999,
                  border: '2px solid',
                  borderColor: color,
                  borderStyle: bubbleBorderStyle,
                  bgcolor: bubbleFill,
                  boxShadow: bubbleShadow,
                  opacity: bubbleOpacity,
                  transition: 'all 180ms ease',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  bgcolor: color,
                  boxShadow: `0 0 0 3px ${isLightMode ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.78)'}`,
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid',
                  borderColor: isLightMode ? 'rgba(203,213,225,0.9)' : 'rgba(148,163,184,0.18)',
                  bgcolor: isLightMode ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.7)',
                  color,
                }}
              >
                <RadarRoundedIcon sx={{ fontSize: 15 }} />
              </Box>
            </Box>

            <Typography
              variant="caption"
              sx={{
                maxWidth: 300,
                textAlign: 'center',
                color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)',
              }}
            >
              Conceptual spread preview, not a live GPS map.
            </Typography>
          </Stack>
        </Box>

        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          flexWrap="wrap"
          sx={{ width: '100%', alignItems: 'flex-start' }}
        >
          <Chip
            size="small"
            label={!profile ? 'No profile' : profile.is_infectious ? 'Infectious' : 'Non-infectious'}
            variant="outlined"
            sx={{
              maxWidth: '100%',
              height: 'auto',
              '& .MuiChip-label': {
                display: 'block',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                py: 0.55,
              },
              ...infectiousChipSx,
            }}
          />
          <SummaryChip label={`Risk ${formatDiseaseMapLabel(profile?.risk_level)}`} isLightMode={isLightMode} />
          <SummaryChip label={`Zone ${formatDiseaseMapLabel(profile?.zone_type)}`} isLightMode={isLightMode} />
          <SummaryChip label={`Radius ${formatDiseaseMapRadius(radius)}`} isLightMode={isLightMode} />
          <SummaryChip label={`Spread ${formatDiseaseMapLabel(profile?.spread_category)}`} isLightMode={isLightMode} />
          <SummaryChip label={`Transmission ${formatDiseaseMapLabel(profile?.transmission_mode)}`} isLightMode={isLightMode} />
        </Stack>
      </Stack>
    </Box>
  );
}
