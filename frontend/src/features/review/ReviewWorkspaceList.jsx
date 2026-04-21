import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import StateBlock from '@/components/ui/StateBlock';
import StatusChip from '@/components/ui/StatusChip';
import {
  formatReviewConfidence,
  formatReviewDateTime,
  resolveInspectionStatusTone,
  resolveProcessingStatusTone,
  resolveReviewDecisionTone,
  resolveReviewerLabel,
} from '@/features/review/utils';

function resolvePredictionLabel(inspection, diseaseMap) {
  const predictedDisease = inspection?.predicted_disease ? diseaseMap.get(inspection.predicted_disease) : null;
  return inspection?.top1_label || predictedDisease?.name || 'Unnamed prediction';
}

function resolveCorrectedDiseaseLabel(review, diseaseMap) {
  if (!review?.corrected_disease) {
    return null;
  }

  return diseaseMap.get(review.corrected_disease)?.name || review.corrected_disease;
}

function resolveDeviceLabel(inspection, deviceMap) {
  const device = inspection?.device ? deviceMap.get(inspection.device) : null;
  return device ? `${device.name} (${device.identifier})` : inspection?.device || 'Unknown device';
}

export default function ReviewWorkspaceList({
  mode = 'pending',
  items,
  selectedItemId,
  onSelectItem,
  diseaseMap,
  deviceMap,
  emptyTitle,
  emptyMessage,
}) {
  if (!items.length) {
    return <StateBlock title={emptyTitle} message={emptyMessage} minHeight={280} />;
  }

  return (
    <Stack spacing={1}>
      {items.map((item) => {
        const inspection = mode === 'history' ? item.inspection : item;
        const review = mode === 'history' ? item.review : null;
        const itemId = mode === 'history' ? review.id : inspection.id;
        const correctedDiseaseLabel = resolveCorrectedDiseaseLabel(review, diseaseMap);
        const isSelected = selectedItemId === itemId;

        return (
          <Card
            key={itemId}
            variant="outlined"
            sx={{
              borderColor: isSelected ? 'primary.main' : 'divider',
              boxShadow: isSelected ? '0 8px 18px rgba(18, 75, 47, 0.08)' : 'none',
              bgcolor: isSelected ? 'rgba(31, 106, 61, 0.04)' : 'background.paper',
            }}
          >
            <CardActionArea onClick={() => onSelectItem(item)}>
              <CardContent>
                <Stack spacing={0.75}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <StatusChip
                      size="small"
                      label={inspection?.organ_type || 'N/A'}
                      tone="stable"
                    />
                    {mode === 'history' ? (
                      <StatusChip
                        size="small"
                        label={review.decision}
                        tone={resolveReviewDecisionTone(review.decision)}
                      />
                    ) : null}
                    <StatusChip
                      size="small"
                      label={inspection?.processing_status || 'pending'}
                      tone={resolveProcessingStatusTone(inspection?.processing_status)}
                    />
                    <StatusChip
                      size="small"
                      label={inspection?.status || 'new'}
                      tone={resolveInspectionStatusTone(inspection?.status)}
                    />
                  </Stack>

                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {resolvePredictionLabel(inspection, diseaseMap)}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Device: {resolveDeviceLabel(inspection, deviceMap)}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {formatReviewConfidence(inspection?.confidence_score)}
                  </Typography>

                  {mode === 'history' ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Inspection: {inspection?.id || review.inspection}
                      </Typography>
                      {correctedDiseaseLabel ? (
                        <Typography variant="body2" color="text.secondary">
                          Corrected disease: {correctedDiseaseLabel}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" color="text.secondary">
                        Reviewed by {resolveReviewerLabel(review)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Reviewed at: {formatReviewDateTime(review.reviewed_at)}
                      </Typography>
                    </>
                  ) : null}

                  <Typography variant="caption" color="text.secondary">
                    Captured at: {formatReviewDateTime(inspection?.captured_at)}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}
