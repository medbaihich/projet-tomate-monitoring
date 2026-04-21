import axiosClient from '@/api/axiosClient';
import { formatReviewDateTime, resolveReviewerLabel } from '@/features/review/utils';

export async function fetchMonitoringSummary() {
  const { data } = await axiosClient.get('/api/v1/monitoring/summary/');
  return data;
}

export async function fetchNotificationReadActivity(params = {}) {
  const { data } = await axiosClient.get('/api/v1/monitoring/notifications/read-activity/', { params });
  return data;
}

export async function fetchUserActivity(params = {}) {
  const { data } = await axiosClient.get('/api/v1/monitoring/users/activity/', { params });
  return data;
}

async function fetchOptionalRecord(path) {
  if (!path) {
    return null;
  }

  const { data } = await axiosClient.get(path);
  return data;
}

function formatDiseaseLabel(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return 'Unnamed alert';
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildReviewSummary(review, inspection, predictedDisease, correctedDisease) {
  if (review?.decision === 'corrected') {
    const previousPrediction = formatDiseaseLabel(
      predictedDisease?.name
      || inspection?.top1_label
      || 'Unknown result',
    );
    const correctedResult = formatDiseaseLabel(
      correctedDisease?.name
      || review?.corrected_disease
      || 'Updated result',
    );

    return `Corrected from ${previousPrediction} to ${correctedResult}`;
  }

  if (review?.decision === 'rejected') {
    return 'Result rejected during review';
  }

  return 'Original result confirmed';
}

export async function fetchMonitoringReviewsPage({ page, pageSize }) {
  const { data } = await axiosClient.get('/api/v1/review/reviews/', {
    params: {
      page: page + 1,
      page_size: pageSize,
      ordering: '-reviewed_at,-created_at',
    },
  });

  const reviews = data?.results ?? [];

  if (!reviews.length) {
    return {
      count: data?.count ?? 0,
      results: [],
    };
  }

  const inspectionMap = new Map();
  const diseaseMap = new Map();

  const inspectionIds = [...new Set(reviews.map((review) => review.inspection).filter(Boolean))];
  await Promise.all(
    inspectionIds.map(async (inspectionId) => {
      const inspection = await fetchOptionalRecord(`/api/v1/inspections/inspections/${inspectionId}/`);
      if (inspection) {
        inspectionMap.set(inspectionId, inspection);
      }
    }),
  );

  const diseaseIds = [
    ...new Set(
      [
        ...reviews.map((review) => review.corrected_disease),
        ...[...inspectionMap.values()].map((inspection) => inspection?.predicted_disease),
      ].filter(Boolean),
    ),
  ];

  await Promise.all(
    diseaseIds.map(async (diseaseId) => {
      const disease = await fetchOptionalRecord(`/api/v1/catalog/diseases/${diseaseId}/`);
      if (disease) {
        diseaseMap.set(diseaseId, disease);
      }
    }),
  );

  return {
    count: data?.count ?? reviews.length,
    results: reviews.map((review) => {
      const inspection = inspectionMap.get(review.inspection) ?? null;
      const predictedDisease = inspection?.predicted_disease
        ? diseaseMap.get(inspection.predicted_disease) ?? null
        : null;
      const correctedDisease = review.corrected_disease
        ? diseaseMap.get(review.corrected_disease) ?? null
        : null;

      return {
        review,
        inspection,
        predictedDisease,
        correctedDisease,
        summary: buildReviewSummary(review, inspection, predictedDisease, correctedDisease),
        reviewerLabel: resolveReviewerLabel(review),
        reviewedAtLabel: formatReviewDateTime(review.reviewed_at || review.created_at),
        inspectionLabel: inspection?.source_message_id || inspection?.id || review.inspection,
      };
    }),
  };
}
