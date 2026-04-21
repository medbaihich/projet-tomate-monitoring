import {
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import PanelCard from '@/components/ui/PanelCard';
import StateBlock from '@/components/ui/StateBlock';
import StatusChip from '@/components/ui/StatusChip';
import {
  buildMetadataRows,
  formatInspectionConfidence,
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDiseaseLabel,
} from '@/features/inspections/utils';

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || 'N/A'}</Typography>
    </Stack>
  );
}

export default function InspectionDetailPanel({ inspection, deviceMap, diseaseMap }) {
  if (!inspection) {
    return (
      <PanelCard minHeight={320}>
        <StateBlock
          title="Select an inspection"
          message="Choose an inspection from the registry to view its operational details and top candidate matches."
          minHeight={220}
        />
      </PanelCard>
    );
  }

  const deviceLabel = resolveInspectionDeviceLabel(inspection.device, deviceMap);
  const predictedDiseaseLabel = inspection.top1_label
    || resolveInspectionDiseaseLabel(inspection.predicted_disease, diseaseMap);
  const topMatches = [...(inspection.matches ?? [])]
    .sort((left, right) => left.rank_order - right.rank_order)
    .slice(0, 3);
  const metadataRows = buildMetadataRows(inspection.extra_metadata);

  return (
    <PanelCard
      title="Inspection details"
      subtitle="Resolved backend fields for the selected inspection record."
      badge={inspection.source_message_id || inspection.id}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {predictedDiseaseLabel}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <StatusChip
              size="small"
              label={inspection.status}
              tone={inspection.status === 'new' ? 'new' : inspection.status === 'reviewed' ? 'reviewed' : 'neutral'}
            />
            <StatusChip
              size="small"
              label={inspection.processing_status}
              tone={inspection.processing_status === 'failed' ? 'failed' : inspection.processing_status === 'completed' ? 'completed' : inspection.processing_status === 'processing' ? 'processing' : 'pending'}
            />
            <Chip size="small" variant="outlined" label={`Organ ${inspection.organ_type || 'N/A'}`} />
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1.1}>
          <DetailRow label="inspection id" value={inspection.id} />
          <DetailRow label="source_message_id" value={inspection.source_message_id} />
          <DetailRow label="device" value={deviceLabel} />
          <DetailRow label="predicted disease" value={resolveInspectionDiseaseLabel(inspection.predicted_disease, diseaseMap)} />
          <DetailRow label="top1_label" value={inspection.top1_label} />
          <DetailRow label="confidence_score" value={formatInspectionConfidence(inspection.confidence_score)} />
          <DetailRow label="captured_at" value={formatInspectionDateTime(inspection.captured_at)} />
          <DetailRow label="received_at" value={formatInspectionDateTime(inspection.received_at)} />
          <DetailRow label="processed_at" value={formatInspectionDateTime(inspection.processed_at)} />
        </Stack>

        <Divider />

        <Stack spacing={0.75}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Top 3 Matches
          </Typography>
          {topMatches.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No candidate matches were returned for this inspection.
            </Typography>
          ) : (
            <List disablePadding>
              {topMatches.map((match) => (
                <ListItem key={match.id} disableGutters sx={{ py: 0.75 }}>
                  <ListItemText
                    primary={`#${match.rank_order} ${match.matched_label || resolveInspectionDiseaseLabel(match.disease, diseaseMap, 'Unknown match')}`}
                    secondary={`Similarity ${formatInspectionConfidence(match.similarity_score)}${match.disease ? ` | Disease ${resolveInspectionDiseaseLabel(match.disease, diseaseMap, 'Unknown disease')}` : ''}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>

        <Divider />

        <Stack spacing={0.75}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Extra metadata
          </Typography>
          {metadataRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No extra metadata was returned for this inspection.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {metadataRows.map((entry) => (
                <DetailRow key={entry.key} label={entry.key} value={entry.value} />
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </PanelCard>
  );
}
