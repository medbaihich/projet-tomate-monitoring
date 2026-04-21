import { isInspectionReviewable } from '../review/utils.js';

export function isValidConfidenceScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function formatConfidencePercentage(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (!isValidConfidenceScore(value)) {
    return 'Invalid';
  }

  return `${Math.round(value * 100)}%`;
}

export function getValidConfidenceScores(inspections) {
  return inspections
    .map((inspection) => inspection.confidence_score)
    .filter((value) => isValidConfidenceScore(value));
}

export function calculateAverageConfidence(inspections) {
  const confidenceValues = getValidConfidenceScores(inspections);

  return confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : null;
}

export function buildConfidenceDistribution(inspections) {
  const ranges = [
    { label: '<= 0.50', key: 'reviewable', color: '#ffa726', predicate: (value) => value <= 0.5, count: 0 },
    { label: '0.51-0.69', key: 'watch', color: '#42a5f5', predicate: (value) => value > 0.5 && value < 0.7, count: 0 },
    { label: '0.70-0.84', key: 'strong', color: '#66bb6a', predicate: (value) => value >= 0.7 && value < 0.85, count: 0 },
    { label: '0.85-1.00', key: 'high', color: '#2e7d32', predicate: (value) => value >= 0.85 && value <= 1, count: 0 },
  ];

  inspections.forEach((inspection) => {
    if (!isValidConfidenceScore(inspection.confidence_score)) {
      return;
    }

    const bucket = ranges.find((range) => range.predicate(inspection.confidence_score));
    if (bucket) {
      bucket.count += 1;
    }
  });

  return ranges.map(({ key, label, color, count }) => ({
    key,
    label,
    color,
    value: count,
  }));
}

export function buildPendingReviewQueue(inspections, reviewedInspectionIds, limit = 6) {
  return inspections
    .filter((inspection) => isInspectionReviewable(inspection, reviewedInspectionIds))
    .slice(0, limit);
}

export function countPendingReviewableInspections(inspections, reviewedInspectionIds) {
  return inspections.filter((inspection) => isInspectionReviewable(inspection, reviewedInspectionIds)).length;
}
