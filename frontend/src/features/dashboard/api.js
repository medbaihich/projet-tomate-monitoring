import axiosClient from '@/api/axiosClient';
import {
  buildConfidenceDistribution,
  buildPendingReviewQueue,
  calculateAverageConfidence,
  countPendingReviewableInspections,
  isValidConfidenceScore,
} from '@/features/dashboard/utils';

async function fetchPage(url, params = {}) {
  const { data } = await axiosClient.get(url, { params });
  return data;
}

async function fetchAllPages(url, params = {}) {
  const items = [];
  let nextUrl = url;
  let currentParams = { page_size: 100, ...params };

  while (nextUrl) {
    const { data } = await axiosClient.get(nextUrl, {
      params: currentParams,
    });

    items.push(...(data.results ?? []));
    nextUrl = data.next;
    currentParams = undefined;
  }

  return items;
}

function groupInspectionsByDay(inspections) {
  const buckets = new Map();

  inspections.forEach((inspection) => {
    if (!inspection.captured_at) {
      return;
    }

    const dayKey = inspection.captured_at.slice(0, 10);
    buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
    .map(([date, count]) => ({
      date,
      count,
      label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      fullLabel: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    }));
}

function buildHighlights(summary) {
  const highlights = [];

  if (summary.processingStatusBreakdown.find((item) => item.key === 'failed')?.value > 0) {
    highlights.push({
      tone: 'error',
      title: 'Processing failures detected',
      message: 'At least one inspection is currently marked with failed processing status.',
    });
  }

  if (summary.pendingReviewCount > 0) {
    highlights.push({
      tone: 'warning',
      title: 'Review workload pending',
      message: `${summary.pendingReviewCount} low-confidence inspections are currently eligible for review.`,
    });
  }

  if (summary.reviewDecisionBreakdown.find((item) => item.key === 'corrected')?.value > 0) {
    highlights.push({
      tone: 'info',
      title: 'Manual corrections present',
      message: 'Corrected reviews indicate the model output still needs human adjustment in some cases.',
    });
  }

  if (summary.deviceCount === 0) {
    highlights.push({
      tone: 'warning',
      title: 'No devices configured',
      message: 'The devices endpoint currently reports zero devices.',
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      tone: 'success',
      title: 'System looks stable',
      message: 'No immediate operational issues were detected from the current backend data.',
    });
  }

  return highlights;
}

function formatRelativeTimestamp(value) {
  if (!value) {
    return 'No recent timestamp available';
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

  if (diffMinutes < 1) {
    return 'Updated just now';
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function countRecentItems(items, dateField, days) {
  const now = Date.now();
  const maxAgeMs = days * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    if (!item[dateField]) {
      return false;
    }

    return now - new Date(item[dateField]).getTime() <= maxAgeMs;
  }).length;
}

function countBy(items, predicate) {
  return items.reduce((count, item) => (predicate(item) ? count + 1 : count), 0);
}

export async function fetchDashboardReferenceData() {
  const [devices, diseases] = await Promise.all([
    fetchAllPages('/api/v1/devices/devices/'),
    fetchAllPages('/api/v1/catalog/diseases/'),
  ]);

  return {
    devices,
    diseases,
  };
}

export async function fetchDashboardData() {
  const [
    deviceCount,
    diseaseCount,
    allInspections,
    recentInspectionsPage,
    allReviews,
  ] = await Promise.all([
    fetchPage('/api/v1/devices/devices/', { page_size: 1 }),
    fetchPage('/api/v1/catalog/diseases/', { page_size: 1 }),
    fetchAllPages('/api/v1/inspections/inspections/'),
    fetchPage('/api/v1/inspections/inspections/', { page_size: 8, ordering: '-captured_at' }),
    fetchAllPages('/api/v1/review/reviews/'),
  ]);

  const deviceCountValue = deviceCount.count ?? 0;
  const diseaseCountValue = diseaseCount.count ?? 0;
  const inspectionCount = allInspections.length;
  const reviewCount = allReviews.length;
  const acceptedReviewCount = countBy(allReviews, (review) => review.decision === 'accepted');
  const correctedReviewCount = countBy(allReviews, (review) => review.decision === 'corrected');
  const rejectedReviewCount = countBy(allReviews, (review) => review.decision === 'rejected');
  const newInspectionCount = countBy(allInspections, (inspection) => inspection.status === 'new');
  const reviewedInspectionCount = countBy(allInspections, (inspection) => inspection.status === 'reviewed');
  const closedInspectionCount = countBy(allInspections, (inspection) => inspection.status === 'closed');
  const pendingProcessingCount = countBy(allInspections, (inspection) => inspection.processing_status === 'pending');
  const processingInspectionCount = countBy(allInspections, (inspection) => inspection.processing_status === 'processing');
  const completedProcessingCount = countBy(allInspections, (inspection) => inspection.processing_status === 'completed');
  const failedProcessingCount = countBy(allInspections, (inspection) => inspection.processing_status === 'failed');
  const leafInspectionCount = countBy(allInspections, (inspection) => inspection.organ_type === 'leaf');
  const fruitInspectionCount = countBy(allInspections, (inspection) => inspection.organ_type === 'fruit');
  const recentInspections = recentInspectionsPage.results ?? [];
  const reviewedInspectionIds = new Set(allReviews.map((review) => review.inspection));
  const eligibleInspectionIds = new Set(
    allInspections
      .filter((inspection) => isValidConfidenceScore(inspection.confidence_score) && inspection.confidence_score <= 0.5)
      .map((inspection) => inspection.id),
  );
  const reviewedEligibleInspectionCount = allReviews.filter((review) => eligibleInspectionIds.has(review.inspection)).length;
  const pendingReviewQueue = buildPendingReviewQueue(allInspections, reviewedInspectionIds, null);
  const averageConfidence = calculateAverageConfidence(allInspections);
  const recentInspectionCount = countRecentItems(allInspections, 'captured_at', 7);
  const pendingReviewCount = countPendingReviewableInspections(allInspections, reviewedInspectionIds);
  const reviewCoverage = eligibleInspectionIds.size ? reviewedEligibleInspectionCount / eligibleInspectionIds.size : 0;
  const latestInspectionAt = recentInspections[0]?.captured_at ?? null;
  const latestReviewAt = allReviews
    .map((review) => review.reviewed_at)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  const summary = {
    deviceCount: deviceCountValue,
    diseaseCount: diseaseCountValue,
    inspectionCount,
    reviewCount,
    pendingReviewCount,
    averageConfidence,
    recentInspectionCount,
    reviewCoverage,
    latestInspectionAt,
    latestReviewAt,
    inspectionFreshnessLabel: formatRelativeTimestamp(latestInspectionAt),
    reviewFreshnessLabel: formatRelativeTimestamp(latestReviewAt),
    inspectionStatusBreakdown: [
      { key: 'new', label: 'New', value: newInspectionCount, color: '#42a5f5' },
      { key: 'reviewed', label: 'Reviewed', value: reviewedInspectionCount, color: '#66bb6a' },
      { key: 'closed', label: 'Closed', value: closedInspectionCount, color: '#ffa726' },
    ],
    processingStatusBreakdown: [
      { key: 'pending', label: 'Pending', value: pendingProcessingCount, color: '#90caf9' },
      { key: 'processing', label: 'Processing', value: processingInspectionCount, color: '#42a5f5' },
      { key: 'completed', label: 'Completed', value: completedProcessingCount, color: '#66bb6a' },
      { key: 'failed', label: 'Failed', value: failedProcessingCount, color: '#ef5350' },
    ],
    reviewDecisionBreakdown: [
      { key: 'accepted', label: 'Accepted', value: acceptedReviewCount, color: '#66bb6a' },
      { key: 'corrected', label: 'Corrected', value: correctedReviewCount, color: '#ffa726' },
      { key: 'rejected', label: 'Rejected', value: rejectedReviewCount, color: '#ef5350' },
    ],
    organTypeBreakdown: [
      { key: 'leaf', label: 'Leaf', value: leafInspectionCount, color: '#4caf50' },
      { key: 'fruit', label: 'Fruit', value: fruitInspectionCount, color: '#ff7043' },
    ],
    inspectionActivity: groupInspectionsByDay(allInspections),
    confidenceDistribution: buildConfidenceDistribution(allInspections),
  };

  return {
    summary,
    allInspections,
    allReviews,
    recentInspections,
    pendingReviewQueue,
    highlights: buildHighlights(summary),
  };
}
