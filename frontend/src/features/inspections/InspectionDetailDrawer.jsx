import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import FmdBadRoundedIcon from '@mui/icons-material/FmdBadRounded';
import {
  buildMetadataRows,
  formatInspectionConfidence,
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDeviceRecord,
  resolveInspectionDiseaseLabel,
  resolveInspectionDiseaseRecord,
} from '@/features/inspections/utils';

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
          whiteSpace: 'pre-wrap',
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

function ListCard({ title, emptyMessage, items, renderItem }) {
  return (
    <Stack spacing={1.05}>
      <Typography variant="subtitle2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <Stack spacing={0.9}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                borderRadius: 1.25,
                border: '1px solid rgba(148, 163, 184, 0.12)',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
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
            bgcolor: 'rgba(2, 6, 23, 0.18)',
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
                    Inspection details
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
                    {predictedDiseaseLabel}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(203, 213, 225, 0.78)', overflowWrap: 'anywhere' }}
                  >
                    {headerDeviceLabel}
                  </Typography>
                </Stack>
                <IconButton
                  onClick={onClose}
                  aria-label="Close inspection details"
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
                  label={`Status ${formatLabel(inspection?.status)}`}
                  sx={{ borderColor: 'rgba(134, 239, 172, 0.32)', color: '#BBF7D0' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Processing ${formatLabel(inspection?.processing_status)}`}
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
            {inspection ? (
              <Stack spacing={1.25}>
                <SectionCard
                  icon={<QueryStatsRoundedIcon fontSize="small" />}
                  title="Inspection"
                  subtitle="Prediction outcome and registry-level fields."
                >
                  <Stack spacing={1.05}>
                    <DetailRow
                      label="Predicted disease"
                      value={resolveInspectionDiseaseLabel(inspection?.predicted_disease, diseaseMap)}
                    />
                    <DetailRow label="Top 1 label" value={inspection?.top1_label} />
                    <DetailRow label="Organ type" value={formatLabel(inspection?.organ_type)} />
                    <DetailRow label="Confidence score" value={formatInspectionConfidence(inspection?.confidence_score)} />
                    <DetailRow label="Status" value={formatLabel(inspection?.status)} />
                    <DetailRow label="Processing status" value={formatLabel(inspection?.processing_status)} />
                    <DetailRow label="Source message ID" value={inspection?.source_message_id} />
                  </Stack>
                </SectionCard>

                <SectionCard
                  icon={<DeviceHubRoundedIcon fontSize="small" />}
                  title="Device context"
                  subtitle="Resolved hierarchy and device identity for this inspection."
                >
                  <Stack spacing={1.05}>
                    <DetailRow label="Device" value={deviceRecord?.name} />
                    <DetailRow label="Identifier" value={deviceRecord?.identifier} />
                    <DetailRow label="Site" value={deviceRecord?.site_name} />
                    <DetailRow label="Greenhouse" value={deviceRecord?.greenhouse_name} />
                    <DetailRow label="Zone" value={deviceRecord?.zone_name} />
                    <DetailRow label="Line" value={deviceRecord?.line_name} />
                  </Stack>
                </SectionCard>

                <SectionCard
                  icon={<ScheduleRoundedIcon fontSize="small" />}
                  title="Timestamps"
                  subtitle="Capture, ingest, processing, and record lifecycle timestamps."
                >
                  <Stack spacing={1.05}>
                    <DetailRow label="Captured at" value={formatInspectionDateTime(inspection?.captured_at)} />
                    <DetailRow label="Received at" value={formatInspectionDateTime(inspection?.received_at)} />
                    <DetailRow label="Processed at" value={formatInspectionDateTime(inspection?.processed_at)} />
                    <DetailRow label="Created at" value={formatInspectionDateTime(inspection?.created_at)} />
                    <DetailRow label="Updated at" value={formatInspectionDateTime(inspection?.updated_at)} />
                  </Stack>
                </SectionCard>

                <SectionCard
                  icon={<MemoryRoundedIcon fontSize="small" />}
                  title="Prediction matches"
                  subtitle="Ranked candidate matches returned with the inspection."
                >
                  <ListCard
                    title="Matches"
                    emptyMessage="No candidate matches were returned for this inspection."
                    items={topMatches}
                    renderItem={(match) => (
                      <Stack spacing={0.55}>
                        <DetailRow label="Rank" value={`#${match.rank_order}`} />
                        <DetailRow label="Matched label" value={match.matched_label} />
                        <DetailRow
                          label="Similarity score"
                          value={formatInspectionConfidence(match.similarity_score)}
                        />
                        <DetailRow
                          label="Disease"
                          value={resolveInspectionDiseaseLabel(match.disease, diseaseMap, 'Unknown disease')}
                        />
                        <DetailRow
                          label="Metadata"
                          value={formatJsonValue(match.metadata_json)}
                        />
                      </Stack>
                    )}
                  />
                </SectionCard>

                <SectionCard
                  icon={<MemoryRoundedIcon fontSize="small" />}
                  title="Extra metadata"
                  subtitle="Structured metadata stored with the inspection record."
                >
                  {metadataRows.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
                      No extra metadata was returned for this inspection.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {metadataRows.map((entry) => (
                        <DetailRow key={entry.key} label={entry.key} value={entry.value} />
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  icon={<FmdBadRoundedIcon fontSize="small" />}
                  title="Map profile summary"
                  subtitle="Current disease spread/risk profile from the predicted disease record."
                >
                  {mapProfile ? (
                    <Stack spacing={1.05}>
                      <DetailRow label="Risk level" value={formatLabel(mapProfile.risk_level)} />
                      <DetailRow label="Zone type" value={formatLabel(mapProfile.zone_type)} />
                      <DetailRow label="Spread radius" value={formatRadius(mapProfile.spread_radius_m)} />
                      <DetailRow
                        label="Infectious"
                        value={mapProfile.is_infectious ? 'Infectious' : 'Non-infectious'}
                      />
                      <DetailRow
                        label="Transmission mode"
                        value={formatLabel(mapProfile.transmission_mode)}
                      />
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.72)' }}>
                      No map profile configured.
                    </Typography>
                  )}
                </SectionCard>

                <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.14)' }} />
              </Stack>
            ) : (
              <Stack spacing={1.5} sx={{ minHeight: 220, justifyContent: 'center' }}>
                {isLoading ? (
                  <Stack spacing={1.5} alignItems="center" textAlign="center">
                    <CircularProgress size={28} sx={{ color: '#86EFAC' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.78)' }}>
                      Loading full inspection details from the archive record.
                    </Typography>
                  </Stack>
                ) : null}

                {!isLoading && errorMessage ? (
                  <Alert
                    severity="error"
                    action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : null}
                    sx={{
                      bgcolor: 'rgba(127, 29, 29, 0.18)',
                      color: '#FEE2E2',
                      border: '1px solid rgba(248, 113, 113, 0.32)',
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
