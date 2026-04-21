import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Portal,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import StateBlock from '@/components/ui/StateBlock';
import StatusChip from '@/components/ui/StatusChip';
import { formatConfidencePercentage } from '@/features/dashboard/utils';
import {
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDiseaseLabel,
} from '@/features/inspections/utils';

function formatDiseaseLabel(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return 'Disease alert';
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function hasText(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value);
}

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <CardContent sx={{ p: 1.35, '&:last-child': { pb: 1.35 } }}>
        <Stack spacing={1.1}>
          <Stack spacing={0.3}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'rgba(211, 47, 47, 0.1)',
                  color: 'error.dark',
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
            </Stack>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
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

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.3}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.55 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function renderItemsList(items, emptyMessage, renderItem) {
  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <List disablePadding>
      {items.map((item, index) => (
        <ListItem
          key={item.id}
          disableGutters
          sx={{
            py: 0.85,
            alignItems: 'flex-start',
            borderBottom: index < items.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          {renderItem(item)}
        </ListItem>
      ))}
    </List>
  );
}

export default function NotificationDetailDrawer({
  open,
  onClose,
  notification,
  inspection,
  disease,
  relatedInspections,
  deviceMap,
  diseaseMap,
}) {
  const diseaseLabel = formatDiseaseLabel(
    disease?.name || inspection?.top1_label || notification?.display_disease_label,
  );
  const inspectionReference = inspection?.source_message_id
    || notification?.payload?.source_message_id
    || notification?.inspection
    || 'N/A';

  const summaryRows = [
    { label: 'alert message', value: notification?.message },
    { label: 'detected disease', value: diseaseLabel },
    { label: 'confidence', value: notification ? formatConfidencePercentage(notification.confidence_score) : null },
    { label: 'alert timestamp', value: formatInspectionDateTime(notification?.created_at) },
    { label: 'inspection reference', value: inspectionReference },
    {
      label: 'device',
      value: inspection
        ? resolveInspectionDeviceLabel(inspection.device, deviceMap)
        : notification?.payload?.device_name
          ? `${notification.payload.device_name} (${notification.payload.device_identifier || 'N/A'})`
          : null,
    },
    {
      label: 'organ type',
      value: inspection?.organ_type || notification?.payload?.organ_type,
    },
    {
      label: 'captured at',
      value: formatInspectionDateTime(inspection?.captured_at || notification?.payload?.captured_at),
    },
  ].filter((row) => hasText(row.value));

  const diseaseOverviewRows = [
    { label: 'summary', value: disease?.summary },
    { label: 'symptoms', value: disease?.symptoms },
    { label: 'prevention', value: disease?.prevention },
  ].filter((row) => hasText(row.value));

  const causes = (disease?.causes ?? []).filter(
    (cause) => hasText(cause.title) || hasText(cause.description),
  );
  const treatments = (disease?.treatments ?? []).filter(
    (treatment) => hasText(treatment.title) || hasText(treatment.description),
  );
  const resources = (disease?.resources ?? []).filter(
    (resource) => hasText(resource.title) || hasText(resource.url) || hasText(resource.description),
  );

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
            bgcolor: 'transparent',
          }}
        />

        <Box
          role="dialog"
          aria-modal="false"
          aria-label="Disease alert details"
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
            bgcolor: 'background.paper',
            borderLeft: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 220ms ease',
            willChange: 'transform',
          }}
        >
          {!notification ? (
            <Box sx={{ p: 2 }}>
              <StateBlock
                title="Select an alert"
                message="Open any disease alert from the dashboard to inspect the current case, related inspections, and catalog guidance."
                minHeight={320}
              />
            </Box>
          ) : (
            <Box
              sx={{
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: { xs: 1.5, sm: 1.75 },
                  py: { xs: 1.1, sm: 1.25 },
                  background: 'linear-gradient(160deg, rgba(183, 28, 28, 0.12), rgba(255, 235, 238, 0.96))',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <Stack spacing={0.95}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                      <Typography variant="overline" color="error.dark" sx={{ lineHeight: 1.1 }}>
                        Disease alert
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                        {diseaseLabel}
                      </Typography>
                      {hasText(notification.title) ? (
                        <Typography variant="body2" color="text.secondary">
                          {notification.title}
                        </Typography>
                      ) : null}
                    </Stack>
                    <IconButton onClick={onClose} aria-label="Close alert details">
                      <CloseRoundedIcon />
                    </IconButton>
                  </Stack>

                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <StatusChip
                      tone={notification.severity === 'high' ? 'critical' : 'alert'}
                      label={notification.severity === 'high' ? 'High alert' : 'Alert'}
                    />
                    <Chip
                      size="small"
                      color={notification.is_read ? 'default' : 'error'}
                      label={notification.is_read ? 'Read' : 'Unread'}
                      variant={notification.is_read ? 'outlined' : 'filled'}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Confidence ${formatConfidencePercentage(notification.confidence_score)}`}
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
                  bgcolor: 'background.default',
                }}
              >
                <Stack spacing={1.25}>
                  <SectionCard
                    icon={<ReportProblemRoundedIcon fontSize="small" />}
                    title="Alert Summary"
                    subtitle="Current alert context and linked inspection details."
                  >
                    <Stack spacing={1.05}>
                      {summaryRows.map((row) => (
                        <DetailRow key={row.label} label={row.label} value={row.value} />
                      ))}
                    </Stack>
                  </SectionCard>

                  {disease ? (
                    <SectionCard
                      icon={<LocalHospitalRoundedIcon fontSize="small" />}
                      title="Disease Reference"
                      subtitle="Catalog guidance currently available for this disease."
                    >
                      <Stack spacing={1.1}>
                        {diseaseOverviewRows.length > 0 ? (
                          <Stack spacing={1.05}>
                            {diseaseOverviewRows.map((row) => (
                              <DetailRow key={row.label} label={row.label} value={row.value} />
                            ))}
                          </Stack>
                        ) : null}

                        {causes.length > 0 ? (
                          <>
                            {diseaseOverviewRows.length > 0 ? <Divider /> : null}
                            <Stack spacing={0.6}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Causes
                              </Typography>
                              {renderItemsList(
                                causes,
                                'No causes are currently listed for this disease.',
                                (cause) => (
                                  <ListItemText
                                    primary={cause.title || 'Untitled cause'}
                                    secondary={cause.description || 'No description'}
                                  />
                                ),
                              )}
                            </Stack>
                          </>
                        ) : null}

                        {treatments.length > 0 ? (
                          <>
                            {diseaseOverviewRows.length > 0 || causes.length > 0 ? <Divider /> : null}
                            <Stack spacing={0.6}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Treatments
                              </Typography>
                              {renderItemsList(
                                treatments,
                                'No treatments are currently listed for this disease.',
                                (treatment) => (
                                  <ListItemText
                                    primary={treatment.title || 'Untitled treatment'}
                                    secondary={treatment.description || 'No description'}
                                  />
                                ),
                              )}
                            </Stack>
                          </>
                        ) : null}

                        {resources.length > 0 ? (
                          <>
                            {diseaseOverviewRows.length > 0 || causes.length > 0 || treatments.length > 0 ? <Divider /> : null}
                            <Stack spacing={0.6}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Resources
                              </Typography>
                              {renderItemsList(
                                resources,
                                'No reference resources are currently listed for this disease.',
                                (resource) => (
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                      {resource.title || 'Reference link'}
                                    </Typography>
                                    {hasText(resource.description) ? (
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.35 }}>
                                        {resource.description}
                                      </Typography>
                                    ) : null}
                                    <Link
                                      href={resource.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      underline="hover"
                                      sx={{ overflowWrap: 'anywhere' }}
                                    >
                                      {resource.url}
                                    </Link>
                                  </Box>
                                ),
                              )}
                            </Stack>
                          </>
                        ) : null}

                        {diseaseOverviewRows.length === 0 && causes.length === 0 && treatments.length === 0 && resources.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            A catalog record was matched, but it does not currently contain additional guidance.
                          </Typography>
                        ) : null}
                      </Stack>
                    </SectionCard>
                  ) : null}

                  <SectionCard
                    icon={<HistoryRoundedIcon fontSize="small" />}
                    title="Historical Context"
                    subtitle="Related inspection cases already stored in the backend."
                  >
                    {relatedInspections.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No previous related cases were found for this disease label yet.
                      </Typography>
                    ) : (
                      <Stack spacing={0.9}>
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${relatedInspections.length} related case${relatedInspections.length === 1 ? '' : 's'}`}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Latest ${formatInspectionDateTime(relatedInspections[0].captured_at || relatedInspections[0].received_at)}`}
                          />
                        </Stack>

                        <List disablePadding>
                          {relatedInspections.map((relatedInspection, index) => (
                            <ListItem
                              key={relatedInspection.id}
                              disableGutters
                              sx={{
                                py: 0.9,
                                alignItems: 'flex-start',
                                borderBottom: index < relatedInspections.length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider',
                              }}
                            >
                              <ListItemText
                                primary={formatDiseaseLabel(
                                  relatedInspection.top1_label
                                  || resolveInspectionDiseaseLabel(
                                    relatedInspection.predicted_disease,
                                    diseaseMap,
                                    diseaseLabel,
                                  ),
                                )}
                                secondary={(
                                  <Stack spacing={0.35} sx={{ mt: 0.45 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      {resolveInspectionDeviceLabel(relatedInspection.device, deviceMap)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Captured {formatInspectionDateTime(relatedInspection.captured_at || relatedInspection.received_at)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Confidence {formatConfidencePercentage(relatedInspection.confidence_score)}
                                    </Typography>
                                  </Stack>
                                )}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Stack>
                    )}
                  </SectionCard>
                </Stack>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Portal>
  );
}
