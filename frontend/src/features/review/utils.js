export function isInspectionReviewable(inspection, reviewedInspectionIds) {
  return (
    !reviewedInspectionIds.has(inspection.id)
    && inspection.confidence_score !== null
    && inspection.confidence_score !== undefined
    && inspection.confidence_score <= 0.5
  );
}

export function formatReviewConfidence(value) {
  if (value === null || value === undefined) {
    return 'No confidence';
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return 'Invalid confidence';
  }

  return `${Math.round(value * 100)}% confidence`;
}

export function formatReviewDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
}

export function resolveReviewerLabel(review) {
  if (review?.reviewer_summary?.full_name) {
    return review.reviewer_summary.full_name;
  }

  if (review?.reviewer_summary?.username) {
    return review.reviewer_summary.username;
  }

  if (review?.reviewer) {
    return review.reviewer;
  }

  return 'Unassigned reviewer';
}

export function resolveInspectionStatusTone(status) {
  if (status === 'reviewed') {
    return 'reviewed';
  }

  if (status === 'closed') {
    return 'inactive';
  }

  return 'new';
}

export function resolveProcessingStatusTone(status) {
  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'processing') {
    return 'processing';
  }

  return 'pending';
}

export function resolveReviewDecisionTone(decision) {
  if (decision === 'accepted') {
    return 'reviewed';
  }

  if (decision === 'corrected') {
    return 'corrected';
  }

  if (decision === 'rejected') {
    return 'rejected';
  }

  return 'neutral';
}
