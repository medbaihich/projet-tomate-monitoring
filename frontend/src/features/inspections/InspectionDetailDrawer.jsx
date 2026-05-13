import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import FmdBadRoundedIcon from '@mui/icons-material/FmdBadRounded';
import DrawerCloseButton from '@/components/ui/DrawerCloseButton';
import {
  buildMetadataRows,
  formatInspectionConfidence,
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDeviceRecord,
  resolveInspectionDiseaseLabel,
  resolveInspectionDiseaseRecord,
} from '@/features/inspections/utils';
import { useThemeMode } from '@/theme-mode-context';

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatValue(value) {
  return hasValue(value) ? value : 'N/A';
}

function formatLabel(value) {
  if (!hasValue(value)) {
    return 'N/A';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRadius(value) {
  if (value === 0) {
    return '0 m';
  }

  if (!hasValue(value)) {
    return 'N/A';
  }

  return `${value} m`;
}

function formatJsonValue(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Unserializable object]';
    }
  }

  return String(value);
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
          whiteSpace: 'pre-wrap',
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
        bgcolor: isLightMode ? 'rgba(255,255,255,0.82)' : 'rgba(255, 255, 255, 0.04)',
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
                bgcolor: isLightMode ? 'rgba(220,252,231,0.86)' : 'rgba(16, 185, 129, 0.12)',
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

function ListCard({ title, emptyMessage, items, renderItem, isLightMode }) {
  return (
    <Stack spacing={1.05}>
      <Typography variant="subtitle2" sx={{ color: isLightMode ? '#0f172a' : '#F8FAFC', fontWeight: 700 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <Stack spacing={0.9}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                borderRadius: 1.25,
                border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148, 163, 184, 0.12)',
                bgcolor: isLightMode ? 'rgba(255,255,255,0.76)' : 'rgba(255, 255, 255, 0.03)',
                px: 1.15,
                py: 1,
              }}
            >
              {renderItem(item)}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default function InspectionDetailDrawer({
  open,
  onClose,
  inspection,
  deviceMap,
  diseaseMap,
  isLoading = false,
  errorMessage = '',
  contextSignal = null,
  onRetry,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const deviceRecord = resolveInspectionDeviceRecord(inspection?.device, deviceMap);
  const diseaseRecord = resolveInspectionDiseaseRecord(inspection?.predicted_disease, diseaseMap);
  const predictedDiseaseLabel = inspection
    ? (inspection.top1_label || resolveInspectionDiseaseLabel(inspection.predicted_disease, diseaseMap))
    : (contextSignal?.disease_name || contextSignal?.label || 'Selected inspection');
  const mapProfile = diseaseRecord?.map_profile || null;
  const metadataRows = buildMetadataRows(inspection?.extra_metadata);
  const topMatches = [...(inspection?.matches ?? [])].sort((left, right) => left.rank_order - right.rank_order);
  const headerDeviceLabel = inspection
    ? resolveInspectionDeviceLabel(inspection?.device, deviceMap)
    : (contextSignal?.device_name || 'Loading inspection details');

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
            bgcolor: isLightMode ? 'rgba(15,23,42,0.12)' : 'rgba(2, 6, 23, 0.18)',
          }}
        />

        <Box
          role="dialog"
          aria-modal="false"
          aria-label="Inspection details"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 'min(540px, calc(100vw - 16px))',
            minWidth: 'min(540px, calc(100vw - 16px))',
            maxWidth: 'min(540px, calc(100vw - 16px))',
            height: '100dvh',
            minHeight: '100dvh',
            maxHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: isLightMode ? '#f8fbf8' : '#07110F',
            borderLeft: isLightMode ? '1px solid rgba(203,213,225,0.95)' : '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: isLightMode ? '0 18px 44px rgba(15,23,42,0.16)' : '0 20px 54px rgba(0, 0, 0, 0.34)',
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
              borderBottom: isLightMode ? '1px solid rgba(226,232,240,0.92)' : '1px solid rgba(148, 163, 184, 0.16)',
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
                    Inspection details
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
                    {predictedDiseaseLabel}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
                  >
                    {headerDeviceLabel}
                  </Typography>
                </Stack>
                <DrawerCloseButton
                  onClick={onClose}
                  aria-label="Close inspection details"
                />
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Status ${formatLabel(inspection?.status)}`}
                  sx={isLightMode
                    ? { borderColor: 'rgba(34,197,94,0.22)', bgcolor: 'rgba(220,252,231,0.78)', color: '#166534' }
                    : { borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Processing ${formatLabel(inspection?.processing_status)}`}
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
            {inspection ? (
              <Stack spacing={1.25}>
                <SectionCard
                  icon={<QueryStatsRoundedIcon fontSize="small" />}
                  title="Inspection"
                  subtitle="Prediction outcome and registry-level fields."
                  isLightMode={isLightMode}
                >
                  <Stack spacing={1.05}>
                    <DetailRow
                      label="Predicted disease"
                      value={resolveInspectionDiseaseLabel(inspection?.predicted_disease, diseaseMap)}
                      isLightMode={isLightMode}
                    />
                    <DetailRow label="Top 1 label" value={inspection?.top1_label} isLightMode={isLightMode} />
                    <DetailRow label="Organ type" value={formatLabel(inspection?.organ_type)} isLightMode={isLightMode} />
                    <DetailRow label="Confidence score" value={formatInspectionConfidence(inspection?.confidence_score)} isLightMode={isLightMode} />
                    <DetailRow label="Status" value={formatLabel(inspection?.status)} isLightMode={isLightMode} />
                    <DetailRow label="Processing status" value={formatLabel(inspection?.processing_status)} isLightMode={isLightMode} />
                    <DetailRow label="Source message ID" value={inspection?.source_message_id} isLightMode={isLightMode} />
                  </Stack>
                </SectionCard>

                <SectionCard
                  icon={<DeviceHubRoundedIcon fontSize="small" />}
                  title="Device context"
                  subtitle="Resolved hierarchy and device identity for this inspection."
                  isLightMode={isLightMode}
                >
                  <Stack spacing={1.05}>
                    <DetailRow label="Device" value={deviceRecord?.name} isLightMode={isLightMode} />
                    <DetailRow label="Identifier" value={deviceRecord?.identifier} isLightMode={isLightMode} />
                    <DetailRow label="Site" value={deviceRecord?.site_name} isLightMode={isLightMode} />
                    <DetailRow label="Greenhouse" value={deviceRecord?.greenhouse_name} isLightMode={isLightMode} />
                    <DetailRow label="Zone" value={deviceRecord?.zone_name} isLightMode={isLightMode} />
                    <DetailRow label="Line" value={deviceRecord?.line_name} isLightMode={isLightMode} />
                  </Stack>
                </SectionCard>

                <SectionCard
                  icon={<ScheduleRoundedIcon fontSize="small" />}
                  title="Timestamps"
                  subtitle="Capture, ingest, processing, and record lifecycle timestamps."
                  isLightMode={isLightMode}
                >
                  <Stack spacing={1.05}>
                    <DetailRow label="Captured at" value={formatInspectionDateTime(inspection?.captured_at)} isLightMode={isLightMode} />
                    <DetailRow label="Received at" value={formatInspectionDateTime(inspection?.received_at)} isLightMode={isLightMode} />
                    <DetailRow label="Processed at" value={formatInspectionDateTime(inspection?.processed_at)} isLightMode={isLightMode} />
                    <DetailRow label="Created at" value={formatInspectionDateTime(inspection?.created_at)} isLightMode={isLightMode} />
                    <DetailRow label="Updated at" value={formatInspectionDateTime(inspection?.updated_at)} isLightMode={isLightMode} />
                  </Stack>
                </SectionCard>

                <SectionCard
                  icon={<MemoryRoundedIcon fontSize="small" />}
                  title="Prediction matches"
                  subtitle="Ranked candidate matches returned with the inspection."
                  isLightMode={isLightMode}
                >
                  <ListCard
                    title="Matches"
                    emptyMessage="No candidate matches were returned for this inspection."
                    items={topMatches}
                    isLightMode={isLightMode}
                    renderItem={(match) => (
                      <Stack spacing={0.55}>
                        <DetailRow label="Rank" value={`#${match.rank_order}`} isLightMode={isLightMode} />
                        <DetailRow label="Matched label" value={match.matched_label} isLightMode={isLightMode} />
                        <DetailRow
                          label="Similarity score"
                          value={formatInspectionConfidence(match.similarity_score)}
                          isLightMode={isLightMode}
                        />
                        <DetailRow
                          label="Disease"
                          value={resolveInspectionDiseaseLabel(match.disease, diseaseMap, 'Unknown disease')}
                          isLightMode={isLightMode}
                        />
                        <DetailRow
                          label="Metadata"
                          value={formatJsonValue(match.metadata_json)}
                          isLightMode={isLightMode}
                        />
                      </Stack>
                    )}
                  />
                </SectionCard>

                <SectionCard
                  icon={<MemoryRoundedIcon fontSize="small" />}
                  title="Extra metadata"
                  subtitle="Structured metadata stored with the inspection record."
                  isLightMode={isLightMode}
                >
                  {metadataRows.length === 0 ? (
                    <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                      No extra metadata was returned for this inspection.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {metadataRows.map((entry) => (
                        <DetailRow key={entry.key} label={entry.key} value={entry.value} isLightMode={isLightMode} />
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  icon={<FmdBadRoundedIcon fontSize="small" />}
                  title="Map profile summary"
                  subtitle="Current disease spread/risk profile from the predicted disease record."
                  isLightMode={isLightMode}
                >
                  {mapProfile ? (
                    <Stack spacing={1.05}>
                      <DetailRow label="Risk level" value={formatLabel(mapProfile.risk_level)} isLightMode={isLightMode} />
                      <DetailRow label="Zone type" value={formatLabel(mapProfile.zone_type)} isLightMode={isLightMode} />
                      <DetailRow label="Spread radius" value={formatRadius(mapProfile.spread_radius_m)} isLightMode={isLightMode} />
                      <DetailRow
                        label="Infectious"
                        value={mapProfile.is_infectious ? 'Infectious' : 'Non-infectious'}
                        isLightMode={isLightMode}
                      />
                      <DetailRow
                        label="Transmission mode"
                        value={formatLabel(mapProfile.transmission_mode)}
                        isLightMode={isLightMode}
                      />
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                      No map profile configured.
                    </Typography>
                  )}
                </SectionCard>

                <Divider sx={{ borderColor: isLightMode ? 'rgba(226,232,240,0.92)' : 'rgba(148, 163, 184, 0.14)' }} />
              </Stack>
            ) : (
              <Stack spacing={1.5} sx={{ minHeight: 220, justifyContent: 'center' }}>
                {isLoading ? (
                  <Stack spacing={1.5} alignItems="center" textAlign="center">
                    <CircularProgress size={28} sx={{ color: isLightMode ? '#16a34a' : '#86EFAC' }} />
                    <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.78)' }}>
                      Loading full inspection details from the archive record.
                    </Typography>
                  </Stack>
                ) : null}

                {!isLoading && errorMessage ? (
                  <Alert
                    severity="error"
                    action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : null}
                    sx={{
                      bgcolor: isLightMode ? 'rgba(254,242,242,0.96)' : 'rgba(127, 29, 29, 0.18)',
                      color: isLightMode ? '#b91c1c' : '#FEE2E2',
                      border: isLightMode ? '1px solid rgba(248,113,113,0.28)' : '1px solid rgba(248, 113, 113, 0.32)',
                    }}
                  >
                    {errorMessage}
                  </Alert>
                ) : null}
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
