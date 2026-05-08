import { formatConfidencePercentage } from '@/features/dashboard/utils'

export function formatDashboardDateTime(value) {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'N/A'
  }

  return date.toLocaleString()
}

export function formatDashboardConfidence(value) {
  return formatConfidencePercentage(value)
}

export function formatDashboardPercentage(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return `${(value * 100).toFixed(digits)}%`
}

export function formatDashboardCount(value) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return new Intl.NumberFormat().format(value)
}

export function normalizeDashboardLabel(value) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function resolveDashboardStatusTone(label) {
  const normalized = normalizeDashboardLabel(label)

  if (!normalized) {
    return 'neutral'
  }

  if (normalized.includes('failed') || normalized.includes('alert') || normalized.includes('high')) {
    return 'failed'
  }

  if (normalized.includes('processing')) {
    return 'processing'
  }

  if (normalized.includes('pending') || normalized.includes('review')) {
    return 'review'
  }

  if (normalized.includes('new')) {
    return 'new'
  }

  if (normalized.includes('completed') || normalized.includes('healthy') || normalized.includes('accepted')) {
    return 'completed'
  }

  return 'neutral'
}
