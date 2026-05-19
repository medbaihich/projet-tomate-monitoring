import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import DrawerCloseButton from '@/components/ui/DrawerCloseButton';
import { useThemeMode } from '@/theme-mode-context';
import {
  createDevicePopupContent,
  deviceMarkerIcon,
  FOCUSED_DIALOG_MAP_ZOOM,
  hasRenderableMapContainer,
  isPresent,
  observeLeafletContainerSize,
  scheduleLeafletMapInvalidate,
  TILE_ATTRIBUTION,
  TILE_URL,
  toValidPosition,
} from '@/features/map/deviceMapUtils';

function formatValue(value) {
  return isPresent(value) ? value : 'N/A';
}

export default function DeviceLocationMapDialog({
  open,
  device,
  onClose,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const mapPosition = useMemo(
    () => toValidPosition(device?.latitude, device?.longitude),
    [device?.latitude, device?.longitude],
  );
  const hasLocalCoordinates = isPresent(device?.local_x) || isPresent(device?.local_y);

  useEffect(() => {
    if (!open || !isDialogVisible || !mapContainerRef.current || !mapPosition) {
      return undefined;
    }

    const container = mapContainerRef.current;

    if (!hasRenderableMapContainer(container)) {
      return undefined;
    }

    const map = L.map(container, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    L.marker(mapPosition, { icon: deviceMarkerIcon })
      .bindPopup(createDevicePopupContent(device))
      .addTo(map)
      .openPopup();

    map.setView(mapPosition, FOCUSED_DIALOG_MAP_ZOOM);

    const stopContainerObserver = observeLeafletContainerSize(container, map);
    const stopScheduledInvalidate = scheduleLeafletMapInvalidate(map);

    return () => {
      stopContainerObserver();
      stopScheduledInvalidate();
      mapInstanceRef.current = null;
      map.remove();
    };
  }, [device, isDialogVisible, mapPosition, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        transition: {
          onEntered: () => setIsDialogVisible(true),
          onExit: () => setIsDialogVisible(false),
          onExited: () => setIsDialogVisible(false),
        },
      }}
      PaperProps={{
        sx: {
          overflow: 'hidden',
          backgroundImage: isLightMode
            ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(244,248,244,0.98))'
            : 'linear-gradient(180deg, rgba(9,16,14,0.99), rgba(5,10,9,0.98))',
          border: isLightMode ? '1px solid rgba(214,224,215,0.95)' : '1px solid rgba(148,163,184,0.16)',
          boxShadow: isLightMode ? '0 20px 44px rgba(15,23,42,0.14)' : '0 22px 54px rgba(0,0,0,0.34)',
        },
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
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Stack spacing={0.45} sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: isLightMode ? '#166534' : '#86EFAC', lineHeight: 1.1, letterSpacing: 1.4 }}
              >
                Device map
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
              ariaLabel="Close device location map"
            />
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              icon={<PlaceRoundedIcon />}
              label={mapPosition ? 'Geographic coordinates available' : 'No geographic coordinates'}
              sx={isLightMode
                ? { borderColor: 'rgba(34,197,94,0.22)', bgcolor: 'rgba(220,252,231,0.78)', color: '#166534' }
                : { borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Line ${device?.line_name || device?.line || 'N/A'}`}
              sx={isLightMode
                ? { borderColor: 'rgba(203,213,225,0.95)', bgcolor: 'rgba(255,255,255,0.82)', color: '#475569' }
                : { borderColor: 'rgba(148, 163, 184, 0.28)', color: '#CBD5E1' }}
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Box>

      <DialogContent sx={{ p: { xs: 1.25, sm: 1.5 }, bgcolor: isLightMode ? '#f1f6f2' : '#050A09' }}>
        {mapPosition ? (
          <Box
            sx={{
              overflow: 'hidden',
              borderRadius: 2,
              border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148,163,184,0.16)',
              bgcolor: isLightMode ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.03)',
              boxShadow: isLightMode ? '0 14px 30px rgba(15,23,42,0.06)' : 'none',
            }}
          >
            <Box
              ref={mapContainerRef}
              sx={{ height: 420, width: '100%' }}
              aria-label="Selected device location map"
            />
          </Box>
        ) : (
          <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{
              minHeight: 320,
              borderRadius: 2,
              border: isLightMode ? '1px dashed rgba(203,213,225,0.95)' : '1px dashed rgba(148,163,184,0.22)',
              bgcolor: isLightMode ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.03)',
              px: 3,
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148,163,184,0.22)',
                bgcolor: isLightMode ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
                color: isLightMode ? '#475569' : '#CBD5E1',
              }}
            >
              <MapOutlinedIcon />
            </Box>
            <Stack spacing={0.75} alignItems="center">
              <Typography variant="h6" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 800 }}>
                No geographic coordinates available
              </Typography>
              <Typography variant="body2" sx={{ maxWidth: 440, color: isLightMode ? '#64748b' : 'rgba(203,213,225,0.78)' }}>
                This device does not currently have a valid latitude and longitude, so it cannot be placed on the geographic map yet.
              </Typography>
            </Stack>
            {hasLocalCoordinates ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
                <Chip
                  size="small"
                  label={`Local X: ${formatValue(device?.local_x)}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Local Y: ${formatValue(device?.local_y)}`}
                  variant="outlined"
                />
              </Stack>
            ) : null}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
