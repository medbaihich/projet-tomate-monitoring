import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';

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

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.35}>
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(148, 163, 184, 0.92)',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(241, 245, 249, 0.96)',
          overflowWrap: 'anywhere',
        }}
      >
        {formatValue(value)}
      </Typography>
    </Stack>
  );
}

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        bgcolor: 'rgba(255, 255, 255, 0.04)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#9AF0C1',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography variant="subtitle2" sx={{ color: '#F8FAFC', fontWeight: 800 }}>
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
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
            bgcolor: 'rgba(2, 6, 23, 0.18)',
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
            bgcolor: '#07110F',
            borderLeft: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 20px 54px rgba(0, 0, 0, 0.34)',
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
              background: 'linear-gradient(160deg, rgba(21, 128, 61, 0.2), rgba(6, 15, 13, 0.98))',
              borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
              flexShrink: 0,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: '#86EFAC', lineHeight: 1.1, letterSpacing: 1.4 }}
                  >
                    Device details
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: '#F8FAFC',
                      fontWeight: 850,
                      letterSpacing: '-0.03em',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {device?.name || 'Selected device'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
                  >
                    {device?.identifier || 'No identifier'}
                  </Typography>
                </Stack>
                <IconButton
                  onClick={onClose}
                  aria-label="Close device details"
                  sx={{
                    color: '#E2E8F0',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  <CloseRoundedIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Line ${device?.line_name || device?.line || 'N/A'}`}
                  sx={{ borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Zone ${device?.zone_name || device?.zone || 'N/A'}`}
                  sx={{ borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
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
              bgcolor: '#050A09',
            }}
          >
            <Stack spacing={1.25}>
              <SectionCard
                icon={<DeviceHubRoundedIcon fontSize="small" />}
                title="Device"
                subtitle="Registry identity and descriptive fields."
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Device name" value={device?.name} />
                  <DetailRow label="Identifier" value={device?.identifier} />
                  <DetailRow label="Description" value={device?.description} />
                  <DetailRow label="Created at" value={formatDateTime(device?.created_at)} />
                  <DetailRow label="Updated at" value={formatDateTime(device?.updated_at)} />
                </Stack>
              </SectionCard>

              <SectionCard
                icon={<RouteRoundedIcon fontSize="small" />}
                title="Hierarchy"
                subtitle="Site to greenhouse to zone to line placement."
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Site" value={hierarchyPath?.siteName || device?.site_name} />
                  <DetailRow label="Greenhouse" value={hierarchyPath?.greenhouseName || device?.greenhouse_name} />
                  <DetailRow label="Zone" value={hierarchyPath?.zoneName || device?.zone_name} />
                  <DetailRow label="Line" value={hierarchyPath?.lineName || device?.line_name} />
                </Stack>
              </SectionCard>

              {(hasCoordinates || hasLocalPosition || hasMapLabel) ? (
                <SectionCard
                  icon={<MyLocationRoundedIcon fontSize="small" />}
                  title="Map Position"
                  subtitle="Optional Phase 6 map foundation fields."
                >
                  <Stack spacing={1.05}>
                    <DetailRow label="Latitude" value={device?.latitude} />
                    <DetailRow label="Longitude" value={device?.longitude} />
                    <DetailRow label="Local X" value={device?.local_x} />
                    <DetailRow label="Local Y" value={device?.local_y} />
                    <DetailRow label="Map label" value={device?.map_label} />
                  </Stack>
                </SectionCard>
              ) : null}

              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.14)' }} />

              <SectionCard
                icon={<DeviceHubRoundedIcon fontSize="small" />}
                title="References"
                subtitle="Backend identifiers for this row."
              >
                <Stack spacing={1.05}>
                  <DetailRow label="Device ID" value={device?.id} />
                  <DetailRow label="Site ID" value={device?.site} />
                  <DetailRow label="Greenhouse ID" value={device?.greenhouse} />
                  <DetailRow label="Zone ID" value={device?.zone} />
                  <DetailRow label="Line ID" value={device?.line} />
                </Stack>
              </SectionCard>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
