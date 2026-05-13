import { isInspectionReviewable } from '../review/utils.js';

const DASHBOARD_RISK_PRIORITY = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function normalizeLabel(value) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

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
    { label: '≤ 50%', key: 'reviewable', color: '#ffa726', predicate: (value) => value <= 0.5, count: 0 },
    { label: '51-69%', key: 'watch', color: '#42a5f5', predicate: (value) => value > 0.5 && value < 0.7, count: 0 },
    { label: '70-84%', key: 'strong', color: '#66bb6a', predicate: (value) => value >= 0.7 && value < 0.85, count: 0 },
    { label: '≥ 85%', key: 'high', color: '#2e7d32', predicate: (value) => value >= 0.85 && value <= 1, count: 0 },
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
  const pendingItems = inspections
    .filter((inspection) => isInspectionReviewable(inspection, reviewedInspectionIds))
    .sort((left, right) => {
      const rightValue = right.captured_at || right.received_at || right.processed_at || '';
      const leftValue = left.captured_at || left.received_at || left.processed_at || '';
      return rightValue.localeCompare(leftValue);
    });

  if (limit === null || limit === undefined) {
    return pendingItems;
  }

  return pendingItems.slice(0, limit);
}

export function countPendingReviewableInspections(inspections, reviewedInspectionIds) {
  return inspections.filter((inspection) => isInspectionReviewable(inspection, reviewedInspectionIds)).length;
}

export function resolveNotificationDiseaseRecord(notification, diseases = []) {
  if (!notification) {
    return null
  }

  if (notification.disease) {
    const matchedById = diseases.find((disease) => disease.id === notification.disease)
    if (matchedById) {
      return matchedById
    }
  }

  const normalizedLabel = normalizeLabel(notification.display_disease_label || notification.title)
  if (!normalizedLabel) {
    return null
  }

  return diseases.find((disease) => (
    normalizeLabel(disease.name) === normalizedLabel
    || normalizeLabel(disease.ai_label) === normalizedLabel
    || normalizeLabel(disease.slug) === normalizedLabel
  )) ?? null
}

export function resolveNotificationRiskLevel(notification, diseases = []) {
  const diseaseRecord = resolveNotificationDiseaseRecord(notification, diseases)
  const mappedRiskLevel = diseaseRecord?.map_profile?.risk_level

  if (mappedRiskLevel && DASHBOARD_RISK_PRIORITY[mappedRiskLevel]) {
    return mappedRiskLevel
  }

  if (notification?.severity === 'high') {
    return 'high'
  }

  if (notification?.severity === 'medium') {
    return 'medium'
  }

  return null
}

export function compareRiskLevels(leftRisk, rightRisk) {
  return (DASHBOARD_RISK_PRIORITY[leftRisk] ?? 0) - (DASHBOARD_RISK_PRIORITY[rightRisk] ?? 0)
}

export function resolveNotificationAlertTimestamp(notification) {
  return (
    notification?.payload?.captured_at
    || notification?.captured_at
    || notification?.created_at
    || notification?.updated_at
    || ''
  )
}

export function sortDiseaseAlertsByPriority(notifications = [], diseases = []) {
  return [...notifications].sort((left, right) => {
    const leftUnreadPriority = left?.is_read ? 0 : 1
    const rightUnreadPriority = right?.is_read ? 0 : 1
    if (leftUnreadPriority !== rightUnreadPriority) {
      return rightUnreadPriority - leftUnreadPriority
    }

    const riskPriorityDifference = compareRiskLevels(
      resolveNotificationRiskLevel(right, diseases),
      resolveNotificationRiskLevel(left, diseases),
    )
    if (riskPriorityDifference !== 0) {
      return riskPriorityDifference
    }

    const rightTimestamp = right?.created_at || right?.updated_at || ''
    const leftTimestamp = left?.created_at || left?.updated_at || ''
    return rightTimestamp.localeCompare(leftTimestamp)
  })
}

export function selectPriorityDiseaseAlert(notifications = [], diseases = []) {
  return sortDiseaseAlertsByPriority(notifications, diseases)[0] ?? null
}

export function selectLatestDiseaseAlert(notifications = []) {
  return [...notifications].sort((left, right) => (
    resolveNotificationAlertTimestamp(right).localeCompare(resolveNotificationAlertTimestamp(left))
  ))[0] ?? null
}

export function getHighestDashboardRisk(notifications = [], diseases = []) {
  return notifications.reduce((highestRisk, notification) => {
    const nextRisk = resolveNotificationRiskLevel(notification, diseases)
    return compareRiskLevels(nextRisk, highestRisk) > 0 ? nextRisk : highestRisk
  }, null)
}

export function buildDiseaseAlertCountLabel(notifications = []) {
  const totalCount = notifications.length
  if (totalCount <= 1) {
    return null
  }

  const unreadCount = notifications.filter((notification) => !notification.is_read).length
  if (unreadCount > 0) {
    return `${unreadCount} unread / ${totalCount} alerts`
  }

  return `${totalCount} alerts`
}

export function buildUnreadDiseaseAlertLine(notifications = []) {
  const unreadCount = notifications.filter((notification) => !notification.is_read).length
  if (unreadCount <= 0) {
    return null
  }

  return `${unreadCount} unread disease alert${unreadCount === 1 ? '' : 's'}`
}
