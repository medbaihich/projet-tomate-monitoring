import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StatusChip from '@/components/ui/StatusChip';
import {
  formatReviewDateTime,
  resolveInspectionStatusTone,
  resolveProcessingStatusTone,
  resolveReviewDecisionTone,
  resolveReviewerLabel,
} from '@/features/review/utils';
import { useThemeMode } from '@/theme-mode-context';

const DECISION_OPTIONS = [
  { value: 'accepted', label: 'accepted' },
  { value: 'corrected', label: 'corrected' },
  { value: 'rejected', label: 'rejected' },
];

function DetailRow({ label, value }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || 'N/A'}</Typography>
    </Stack>
  );
}

export default function ReviewDetailPanel({
  inspection,
  review = null,
  mode = 'pending',
  diseaseMap,
  deviceMap,
  diseases,
  submitMutation,
  submitError,
  isSubmittedState = false,
}) {
  const { mode: themeMode } = useThemeMode();
  const isLightMode = themeMode === 'light';
  const [decision, setDecision] = useState('accepted');
  const [correctedDisease, setCorrectedDisease] = useState('');
  const [comments, setComments] = useState('');
  const [clientError, setClientError] = useState('');

  const predictedDisease = inspection?.predicted_disease
    ? diseaseMap.get(inspection.predicted_disease)
    : null;
  const correctedDiseaseDetails = review?.corrected_disease
    ? diseaseMap.get(review.corrected_disease)
    : null;
  const device = inspection ? deviceMap.get(inspection.device) : null;
  const isHistoryMode = mode === 'history';
  const isReadOnly = isSubmittedState || isHistoryMode;

  const sortedMatches = useMemo(
    () => [...(inspection?.matches ?? [])].sort((a, b) => a.rank_order - b.rank_order),
    [inspection?.matches],
  );

  if (!inspection) {
    return (
      <Card
        sx={{
          height: '100%',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: isLightMode ? 'rgba(214,224,215,0.95)' : 'divider',
          boxShadow: isLightMode ? '0 16px 34px rgba(22, 48, 35, 0.06)' : undefined,
        }}
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 340 }}>
          <Stack spacing={1.5} sx={{ textAlign: 'center', maxWidth: 340 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {isHistoryMode ? 'Select a reviewed item' : 'Select an inspection'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isHistoryMode
                ? 'Choose a reviewed item from history to inspect the recorded decision and linked inspection details.'
                : 'Choose an inspection from the review queue to inspect the prediction and submit a review.'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = () => {
    setClientError('');

    if (decision === 'corrected' && !correctedDisease) {
      setClientError('A corrected disease is required when the review decision is corrected.');
      return;
    }

    const payload = {
      inspection: inspection.id,
      decision,
      comments,
    };

    if (decision === 'corrected') {
      payload.corrected_disease = correctedDisease;
    }

    submitMutation.mutate(payload);
  };

  return (
    <Card
      sx={{
        height: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: isLightMode ? 'rgba(214,224,215,0.95)' : 'divider',
        backgroundImage: isLightMode
          ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,248,244,0.98))'
          : 'none',
        boxShadow: isLightMode ? '0 16px 34px rgba(22, 48, 35, 0.06)' : undefined,
      }}
    >
      <CardContent sx={{ p: 1.4, '&:last-child': { pb: 1.4 } }}>
        <Stack spacing={1.5}>
          <Stack spacing={0.6}>
            <Typography variant="overline" color="primary.main">
              {isHistoryMode ? 'Reviewed history' : isReadOnly ? 'Review submitted' : 'Review workspace'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {inspection.top1_label || predictedDisease?.name || 'Inspection'}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
              <StatusChip size="small" label={`Organ ${inspection.organ_type}`} tone="stable" />
              {review ? (
                <StatusChip
                  size="small"
                  label={`Decision ${review.decision}`}
                  tone={resolveReviewDecisionTone(review.decision)}
                />
              ) : null}
            </Stack>
          </Stack>

          <Divider />

          {isReadOnly ? (
            <>
              <Alert severity="success">
                Review submitted successfully. This inspection is now shown in its updated read-only state and has
                left the review queue.
              </Alert>
              <Divider />
            </>
          ) : null}

          <Stack spacing={1.5}>
            <DetailRow label="inspection id" value={inspection.id} />
            <DetailRow
              label="device"
              value={device ? `${device.name} (${device.identifier})` : inspection.device}
            />
            <DetailRow
              label="predicted_disease"
              value={predictedDisease ? `${predictedDisease.name} (${predictedDisease.id})` : inspection.predicted_disease}
            />
            <DetailRow label="top1_label" value={inspection.top1_label} />
            <DetailRow label="confidence_score" value={inspection.confidence_score} />
            <DetailRow label="source_message_id" value={inspection.source_message_id} />
            <DetailRow label="captured_at" value={formatReviewDateTime(inspection.captured_at)} />
            <DetailRow label="received_at" value={formatReviewDateTime(inspection.received_at)} />
            <DetailRow label="processed_at" value={formatReviewDateTime(inspection.processed_at)} />
          </Stack>

          {review ? (
            <>
              <Divider />

              <Stack spacing={1.1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Review record
                </Typography>
                <DetailRow label="review id" value={review.id} />
                <DetailRow label="decision" value={review.decision} />
                <DetailRow
                  label="corrected_disease"
                  value={correctedDiseaseDetails ? `${correctedDiseaseDetails.name} (${correctedDiseaseDetails.id})` : review.corrected_disease}
                />
                <DetailRow label="reviewer" value={resolveReviewerLabel(review)} />
                <DetailRow label="reviewed_at" value={formatReviewDateTime(review.reviewed_at)} />
                <DetailRow label="comments" value={review.comments} />
              </Stack>
            </>
          ) : null}

          <Divider />

          <Stack spacing={0.75}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Candidate matches
            </Typography>
            {sortedMatches.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No candidate matches returned by the backend.
              </Typography>
            ) : (
              <List disablePadding>
                {sortedMatches.map((match) => {
                  const matchedDisease = match.disease ? diseaseMap.get(match.disease) : null;

                  return (
                    <ListItem key={match.id} disableGutters sx={{ py: 0.75 }}>
                      <ListItemText
                        primary={`#${match.rank_order} ${matchedDisease?.name || match.matched_label}`}
                        secondary={`similarity_score: ${match.similarity_score}`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {isHistoryMode ? 'Stored review' : isReadOnly ? 'Submitted review' : 'Submit review'}
            </Typography>

            {clientError ? <Alert severity="warning">{clientError}</Alert> : null}
            {submitError && !isHistoryMode ? (
              <Alert severity="error">
                {submitError?.response?.data?.corrected_disease?.[0]
                  || submitError?.response?.data?.detail
                  || submitError?.message
                  || 'Failed to submit review.'}
              </Alert>
            ) : null}

            {isHistoryMode ? (
              <Typography variant="body2" color="text.secondary">
                This review is loaded from backend history and is shown in read-only mode.
              </Typography>
            ) : (
              <>
                <FormControl fullWidth>
                  <InputLabel id="review-decision-label">Decision</InputLabel>
                  <Select
                    labelId="review-decision-label"
                    label="Decision"
                    value={decision}
                    onChange={(event) => setDecision(event.target.value)}
                    disabled={submitMutation.isPending || isReadOnly}
                  >
                    {DECISION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {decision === 'corrected' ? (
                  <FormControl fullWidth required>
                    <InputLabel id="corrected-disease-label">Corrected Disease</InputLabel>
                    <Select
                      labelId="corrected-disease-label"
                      label="Corrected Disease"
                      value={correctedDisease}
                      onChange={(event) => setCorrectedDisease(event.target.value)}
                      disabled={submitMutation.isPending || isReadOnly}
                    >
                      {diseases.map((disease) => (
                        <MenuItem key={disease.id} value={disease.id}>
                          {disease.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}

                <TextField
                  label="Comments"
                  multiline
                  minRows={3}
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  disabled={submitMutation.isPending || isReadOnly}
                />

                {!isReadOnly ? (
                  <Box>
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </Box>
                ) : null}
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
