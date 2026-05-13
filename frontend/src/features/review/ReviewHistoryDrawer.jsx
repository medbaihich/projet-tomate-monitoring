import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import DrawerCloseButton from '@/components/ui/DrawerCloseButton';
import StatusChip from '@/components/ui/StatusChip';
import { useThemeMode } from '@/theme-mode-context';
import {
  formatReviewConfidence,
  formatReviewDateTime,
  resolveInspectionStatusTone,
  resolveProcessingStatusTone,
  resolveReviewDecisionTone,
  resolveReviewerLabel,
} from '@/features/review/utils';

function formatLabel(value, fallback = 'N/A') {
  if (!value) {
    return fallback;
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolvePredictedDiseaseLabel(inspection, diseaseMap) {
  if (inspection?.top1_label) {
    return inspection.top1_label;
  }

  if (inspection?.predicted_disease) {
    return diseaseMap.get(inspection.predicted_disease)?.name || inspection.predicted_disease;
  }

  return 'Reviewed inspection';
}

function resolveDeviceLabel(inspection, deviceMap) {
  if (!inspection?.device) {
    return 'Unknown device';
  }

  const device = deviceMap.get(inspection.device);
  if (!device) {
    return inspection.device;
  }

  return device.identifier ? `${device.name} (${device.identifier})` : device.name;
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
        {value || 'N/A'}
      </Typography>
    </Stack>
  );
}

function SectionCard({ icon, title, children, isLightMode }) {
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
        <Stack spacing={1.1}>
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
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ReviewHistoryDrawer({
  open,
  onClose,
  item,
  diseaseMap,
  deviceMap,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const review = item?.review ?? null;
  const inspection = item?.inspection ?? null;
  const predictedDiseaseLabel = resolvePredictedDiseaseLabel(inspection, diseaseMap);
  const correctedDiseaseLabel = review?.corrected_disease
    ? (diseaseMap.get(review.corrected_disease)?.name || review.corrected_disease)
    : null;
  const sortedMatches = [...(inspection?.matches ?? [])].sort((left, right) => left.rank_order - right.rank_order);

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
          aria-label="Reviewed inspection details"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 'min(560px, calc(100vw - 16px))',
            minWidth: 'min(560px, calc(100vw - 16px))',
            maxWidth: 'min(560px, calc(100vw - 16px))',
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
                    Reviewed history
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
                    {resolveDeviceLabel(inspection, deviceMap)}
                  </Typography>
                </Stack>
                <DrawerCloseButton
                  onClick={onClose}
                  aria-label="Close reviewed inspection details"
                />
              </Stack>

              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {review ? (
                  <StatusChip
                    size="small"
                    label={`Decision ${review.decision}`}
                    tone={resolveReviewDecisionTone(review.decision)}
                  />
                ) : null}
                {inspection ? (
                  <>
                    <StatusChip
                      size="small"
                      label={`Status ${inspection.status}`}
                      tone={resolveInspectionStatusTone(inspection.status)}
                    />
                    <StatusChip
                      size="small"
                      label={`Processing ${inspection.processing_status}`}
                      tone={resolveProcessingStatusTone(inspection.processing_status)}
                    />
                    <StatusChip
                      size="small"
                      label={`Organ ${inspection.organ_type}`}
                      tone="stable"
                    />
                  </>
                ) : null}
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
              {!inspection ? (
                <Alert
                  severity="warning"
                  sx={{
                    bgcolor: isLightMode ? 'rgba(255,251,235,0.96)' : 'rgba(133, 77, 14, 0.2)',
                    color: isLightMode ? '#92400e' : '#FEF3C7',
                    border: isLightMode ? '1px solid rgba(251,191,36,0.32)' : '1px solid rgba(251, 191, 36, 0.28)',
                  }}
                >
                  The linked inspection record is not currently available. Review record details are still shown below.
                </Alert>
              ) : null}

              <SectionCard icon={<RuleRoundedIcon fontSize="small" />} title="Review outcome" isLightMode={isLightMode}>
                <Stack spacing={1.05}>
                  <DetailRow label="Decision" value={formatLabel(review?.decision)} isLightMode={isLightMode} />
                  <DetailRow label="Reviewed by" value={resolveReviewerLabel(review)} isLightMode={isLightMode} />
                  <DetailRow label="Reviewed at" value={formatReviewDateTime(review?.reviewed_at)} isLightMode={isLightMode} />
                  <DetailRow label="Corrected disease" value={correctedDiseaseLabel} isLightMode={isLightMode} />
                  <DetailRow label="Comments" value={review?.comments} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              <SectionCard icon={<QueryStatsRoundedIcon fontSize="small" />} title="Inspection summary" isLightMode={isLightMode}>
                <Stack spacing={1.05}>
                  <DetailRow label="Disease title" value={predictedDiseaseLabel} isLightMode={isLightMode} />
                  <DetailRow
                    label="Predicted disease"
                    value={inspection?.predicted_disease
                      ? (diseaseMap.get(inspection.predicted_disease)?.name || inspection.predicted_disease)
                      : null}
                    isLightMode={isLightMode}
                  />
                  <DetailRow label="Top 1 label" value={inspection?.top1_label} isLightMode={isLightMode} />
                  <DetailRow label="Confidence score" value={formatReviewConfidence(inspection?.confidence_score)} isLightMode={isLightMode} />
                  <DetailRow label="Inspection status" value={formatLabel(inspection?.status)} isLightMode={isLightMode} />
                  <DetailRow label="Processing status" value={formatLabel(inspection?.processing_status)} isLightMode={isLightMode} />
                  <DetailRow label="Organ type" value={formatLabel(inspection?.organ_type)} isLightMode={isLightMode} />
                  <DetailRow label="Inspection ID" value={inspection?.id || review?.inspection} isLightMode={isLightMode} />
                  <DetailRow label="Source message ID" value={inspection?.source_message_id} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              <SectionCard icon={<DeviceHubRoundedIcon fontSize="small" />} title="Device context" isLightMode={isLightMode}>
                <Stack spacing={1.05}>
                  <DetailRow label="Device" value={resolveDeviceLabel(inspection, deviceMap)} isLightMode={isLightMode} />
                  <DetailRow label="Site" value={inspection?.device ? deviceMap.get(inspection.device)?.site_name : null} isLightMode={isLightMode} />
                  <DetailRow label="Greenhouse" value={inspection?.device ? deviceMap.get(inspection.device)?.greenhouse_name : null} isLightMode={isLightMode} />
                  <DetailRow label="Zone" value={inspection?.device ? deviceMap.get(inspection.device)?.zone_name : null} isLightMode={isLightMode} />
                  <DetailRow label="Line" value={inspection?.device ? deviceMap.get(inspection.device)?.line_name : null} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              <SectionCard icon={<ScheduleRoundedIcon fontSize="small" />} title="Timestamps" isLightMode={isLightMode}>
                <Stack spacing={1.05}>
                  <DetailRow label="Captured at" value={formatReviewDateTime(inspection?.captured_at)} isLightMode={isLightMode} />
                  <DetailRow label="Received at" value={formatReviewDateTime(inspection?.received_at)} isLightMode={isLightMode} />
                  <DetailRow label="Processed at" value={formatReviewDateTime(inspection?.processed_at)} isLightMode={isLightMode} />
                  <DetailRow label="Created at" value={formatReviewDateTime(inspection?.created_at)} isLightMode={isLightMode} />
                </Stack>
              </SectionCard>

              <SectionCard icon={<MemoryRoundedIcon fontSize="small" />} title="Candidate matches" isLightMode={isLightMode}>
                {sortedMatches.length === 0 ? (
                  <Typography variant="body2" sx={{ color: isLightMode ? '#64748b' : 'rgba(203, 213, 225, 0.72)' }}>
                    No candidate matches were returned for this inspection.
                  </Typography>
                ) : (
                  <Stack spacing={0.9}>
                    {sortedMatches.map((match) => (
                      <Box
                        key={match.id}
                        sx={{
                          borderRadius: 1.25,
                          border: isLightMode ? '1px solid rgba(203,213,225,0.92)' : '1px solid rgba(148, 163, 184, 0.12)',
                          bgcolor: isLightMode ? 'rgba(255,255,255,0.76)' : 'rgba(255, 255, 255, 0.03)',
                          px: 1.15,
                          py: 1,
                        }}
                      >
                        <Stack spacing={0.65}>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            <Chip
                              size="small"
                              label={`#${match.rank_order}`}
                              variant="outlined"
                              sx={isLightMode
                                ? { borderColor: 'rgba(34,197,94,0.22)', bgcolor: 'rgba(220,252,231,0.78)', color: '#166534' }
                                : { borderColor: 'rgba(134, 239, 172, 0.28)', color: '#BBF7D0' }}
                            />
                          </Stack>
                          <DetailRow
                            label="Disease"
                            value={match.disease ? (diseaseMap.get(match.disease)?.name || match.disease) : match.matched_label}
                            isLightMode={isLightMode}
                          />
                          <DetailRow label="Matched label" value={match.matched_label} isLightMode={isLightMode} />
                          <DetailRow label="Similarity score" value={formatReviewConfidence(match.similarity_score)} isLightMode={isLightMode} />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
