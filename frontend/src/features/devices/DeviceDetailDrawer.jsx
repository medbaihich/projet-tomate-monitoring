import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import DrawerCloseButton from '@/components/ui/DrawerCloseButton';
import { useThemeMode } from '@/theme-mode-context';

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatValue(value) {
  return hasValue(value) ? value : 'N/A';
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function DetailRow({ label, value, isLightMode }) {
  return (
    <Stack spacing={0.35}>
      <Typography
        variant="caption"
        sx={{
          color: isLightMode ? '#64748b' : 'rgba(148, 163, 184, 0.92)',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: isLightMode ? '#0f172a' : 'rgba(241, 245, 249, 0.96)',
          overflowWrap: 'anywhere',
        }}
      >
        {formatValue(value)}
      </Typography>
    </Stack>
  );
}

function SectionCard({ icon, title, subtitle, children, isLightMode }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        bgcolor: isLightMode ? 'rgba(255, 255, 255, 0.82)' : 'rgba(255, 255, 255, 0.04)',
        borderColor: isLightMode ? 'rgba(203, 213, 225, 0.92)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isLightMode ? '0 10px 24px rgba(15,23,42,0.04)' : 'none',
      }}
    >
      <CardContent sx={{ p: 1.35, '&:last-child': { pb: 1.35 } }}>
        <Stack spacing={1.15}>
          <Stack spacing={0.35}>
            <Stack direction="row" spacing={0.85} alignItems="center">
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: isLightMode ? 'rgba(220, 252, 231, 0.86)' : 'rgba(16, 185, 129, 0.12)',
                  color: isLightMode ? '#166534' : '#9AF0C1',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography variant="subtitle2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 800 }}>
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DeviceDetailDrawer({
  open,
  onClose,
  device,
  hierarchyPath,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const hasCoordinates = hasValue(device?.latitude) || hasValue(device?.longitude);
  const hasLocalPosition = hasValue(device?.local_x) || hasValue(device?.local_y);
  const hasMapLabel = hasValue(device?.map_label);

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: (theme) => theme.zIndex.drawer,
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <Box
          onClick={onClose}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: isLightMode ? 'rgba(15, 23, 42, 0.12)' : 'rgba(2, 6, 23, 0.18)',
          }}
        />

        <Box
          role="dialog"
          aria-modal="false"
          aria-label="Device details"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 'min(480px, calc(100vw - 16px))',
            minWidth: 'min(480px, calc(100vw - 16px))',
            maxWidth: 'min(480px, calc(100vw - 16px))',
            height: '100dvh',
            minHeight: '100dvh',
            maxHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: isLightMode ? '#f8fbf8' : '#07110F',
            borderLeft: isLightMode ? '1px solid rgba(203, 213, 225, 0.95)' : '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: isLightMode ? '0 18px 44px rgba(15, 23, 42, 0.16)' : '0 20px 54px rgba(0, 0, 0, 0.34)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 220ms ease',
            willChange: 'transform',
          }}
        >
          <Box
            sx={{
              px: { xs: 1.5, sm: 1.75 },
              py: { xs: 1.15, sm: 1.35 },
              background: isLightMode
                ? 'linear-gradient(160deg, rgba(220,252,231,0.88), rgba(255,255,255,0.98))'
                : 'linear-gradient(160deg, rgba(21, 128, 61, 0.2), rgba(6, 15, 13, 0.98))',
              borderBottom: isLightMode ? '1px solid rgba(226, 232, 240, 0.92)' : '1px solid rgba(148, 163, 184, 0.16)',
              flexShrink: 0,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: isLightMode ? '#166534' : '#86EFAC', lineHeight: 1.1, letterSpacing: 1.4 }}
                  >
                    Device details
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: isLightMode ? '#0f172a' : '#F8FAFC',
                      fontWeight: 850,
                      letterSpacing: '-0.03em',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {device?.name || 'Selected device'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
                  >
                    {device?.identifier || 'No identifier'}
                  </Typography>
                </Stack>
                <DrawerCloseButton
                  onClick={onClose}
                  aria-label="Close device details"
                />
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Line ${device?.line_name || device?.line || 'N/A'}`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(34,197,94,0.22)', bgcolor: 'rgba(220,252,231,0.78)', color: '#166534' }
                    : { borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Zone ${device?.zone_name || device?.zone || 'N/A'}`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(203,213,225,0.95)', bgcolor: 'rgba(255,255,255,0.82)', color: '#475569' }
                    : { borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              p: { xs: 1.25, sm: 1.5 },
              bgcolor: isLightMode ? '#f1f6f2' : '#050A09',
            }}
          >
            <Stack spacing={1.25}>
              <SectionCard
                icon={<DeviceHubRoundedIcon fontSize="small" />}
                title="Device"
                subtitle="Registry identity and descriptive fields."
                isLightMode={isLightMode}
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Device name" value={device?.name} isLightMode={isLightMode} />
                  <DetailRow label="Identifier" value={device?.identifier} isLightMode={isLightMode} />
                  <DetailRow label="Description" value={device?.description} isLightMode={isLightMode} />
                  <DetailRow label="Created at" value={formatDateTime(device?.created_at)} isLightMode={isLightMode} />
                  <DetailRow label="Updated at" value={formatDateTime(device?.updated_at)} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              <SectionCard
                icon={<RouteRoundedIcon fontSize="small" />}
                title="Hierarchy"
                subtitle="Site to greenhouse to zone to line placement."
                isLightMode={isLightMode}
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Site" value={hierarchyPath?.siteName || device?.site_name} isLightMode={isLightMode} />
                  <DetailRow label="Greenhouse" value={hierarchyPath?.greenhouseName || device?.greenhouse_name} isLightMode={isLightMode} />
                  <DetailRow label="Zone" value={hierarchyPath?.zoneName || device?.zone_name} isLightMode={isLightMode} />
                  <DetailRow label="Line" value={hierarchyPath?.lineName || device?.line_name} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              {(hasCoordinates || hasLocalPosition || hasMapLabel) ? (
                <SectionCard
                  icon={<MyLocationRoundedIcon fontSize="small" />}
                  title="Map Position"
                  subtitle="Optional Phase 6 map foundation fields."
                  isLightMode={isLightMode}
                >
                  <Stack spacing={1.05}>
                    <DetailRow label="Latitude" value={device?.latitude} isLightMode={isLightMode} />
                    <DetailRow label="Longitude" value={device?.longitude} isLightMode={isLightMode} />
                    <DetailRow label="Local X" value={device?.local_x} isLightMode={isLightMode} />
                    <DetailRow label="Local Y" value={device?.local_y} isLightMode={isLightMode} />
                    <DetailRow label="Map label" value={device?.map_label} isLightMode={isLightMode} />
                  </Stack>
                </SectionCard>
              ) : null}

              <Divider sx={{ borderColor: isLightMode ? 'rgba(226, 232, 240, 0.92)' : 'rgba(148, 163, 184, 0.14)' }} />

              <SectionCard
                icon={<DeviceHubRoundedIcon fontSize="small" />}
                title="References"
                subtitle="Backend identifiers for this row."
                isLightMode={isLightMode}
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Device ID" value={device?.id} isLightMode={isLightMode} />
                  <DetailRow label="Site ID" value={device?.site} isLightMode={isLightMode} />
                  <DetailRow label="Greenhouse ID" value={device?.greenhouse} isLightMode={isLightMode} />
                  <DetailRow label="Zone ID" value={device?.zone} isLightMode={isLightMode} />
                  <DetailRow label="Line ID" value={device?.line} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
