import axiosClient from '@/api/axiosClient';
import {
  buildConfidenceDistribution,
  buildPendingReviewQueue,
  calculateAverageConfidence,
  countPendingReviewableInspections,
  isValidConfidenceScore,
} from '@/features/dashboard/utils';

async function fetchCount(url, params = {}) {
  const { data } = await axiosClient.get(url, {
    params: {
      page_size: 1,
      ...params,
    },
  });

  return data.count ?? 0;
}

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

export async function fetchDashboardData() {
  const [
    deviceCount,
    diseaseCount,
    inspectionCount,
    reviewCount,
    acceptedReviewCount,
    correctedReviewCount,
    rejectedReviewCount,
    newInspectionCount,
    reviewedInspectionCount,
    closedInspectionCount,
    pendingProcessingCount,
    processingInspectionCount,
    completedProcessingCount,
    failedProcessingCount,
    leafInspectionCount,
    fruitInspectionCount,
    allInspections,
    recentInspectionsPage,
    devices,
    diseases,
    allReviews,
  ] = await Promise.all([
    fetchCount('/api/v1/devices/devices/'),
    fetchCount('/api/v1/catalog/diseases/'),
    fetchCount('/api/v1/inspections/inspections/'),
    fetchCount('/api/v1/review/reviews/'),
    fetchCount('/api/v1/review/reviews/', { decision: 'accepted' }),
    fetchCount('/api/v1/review/reviews/', { decision: 'corrected' }),
    fetchCount('/api/v1/review/reviews/', { decision: 'rejected' }),
    fetchCount('/api/v1/inspections/inspections/', { status: 'new' }),
    fetchCount('/api/v1/inspections/inspections/', { status: 'reviewed' }),
    fetchCount('/api/v1/inspections/inspections/', { status: 'closed' }),
    fetchCount('/api/v1/inspections/inspections/', { processing_status: 'pending' }),
    fetchCount('/api/v1/inspections/inspections/', { processing_status: 'processing' }),
    fetchCount('/api/v1/inspections/inspections/', { processing_status: 'completed' }),
    fetchCount('/api/v1/inspections/inspections/', { processing_status: 'failed' }),
    fetchCount('/api/v1/inspections/inspections/', { organ_type: 'leaf' }),
    fetchCount('/api/v1/inspections/inspections/', { organ_type: 'fruit' }),
    fetchAllPages('/api/v1/inspections/inspections/'),
    fetchPage('/api/v1/inspections/inspections/', { page_size: 5, ordering: '-captured_at' }),
    fetchAllPages('/api/v1/devices/devices/'),
    fetchAllPages('/api/v1/catalog/diseases/'),
    fetchAllPages('/api/v1/review/reviews/'),
  ]);

  const recentInspections = recentInspectionsPage.results ?? [];
  const reviewedInspectionIds = new Set(allReviews.map((review) => review.inspection));
  const eligibleInspectionIds = new Set(
    allInspections
      .filter((inspection) => isValidConfidenceScore(inspection.confidence_score) && inspection.confidence_score <= 0.5)
      .map((inspection) => inspection.id),
  );
  const reviewedEligibleInspectionCount = allReviews.filter((review) => eligibleInspectionIds.has(review.inspection)).length;
  const pendingReviewQueue = buildPendingReviewQueue(recentInspections, reviewedInspectionIds, 6);
  const averageConfidence = calculateAverageConfidence(recentInspections);
  const recentInspectionCount = countRecentItems(recentInspections, 'captured_at', 7);
  const pendingReviewCount = countPendingReviewableInspections(allInspections, reviewedInspectionIds);
  const reviewCoverage = eligibleInspectionIds.size ? reviewedEligibleInspectionCount / eligibleInspectionIds.size : 0;
  const latestInspectionAt = recentInspections[0]?.captured_at ?? null;
  const latestReviewAt = allReviews
    .map((review) => review.reviewed_at)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  const summary = {
    deviceCount,
    diseaseCount,
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
    recentInspections: recentInspections.slice(0, 8),
    pendingReviewQueue,
    devices,
    diseases,
    highlights: buildHighlights(summary),
  };
}
