import assert from 'node:assert/strict';

import { isInspectionReviewable } from './features/review/utils.js';
import {
  buildConfidenceDistribution,
  buildPendingReviewQueue,
  calculateAverageConfidence,
  countPendingReviewableInspections,
  formatConfidencePercentage,
} from './features/dashboard/utils.js';

function buildInspection(id, confidenceScore) {
  return {
    id,
    confidence_score: confidenceScore,
  };
}

function runTest(name, callback) {
  try {
    callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('review workflow includes unreviewed inspections with confidence 0.5', () => {
  const reviewedInspectionIds = new Set();

  assert.equal(
    isInspectionReviewable(buildInspection('inspection-1', 0.5), reviewedInspectionIds),
    true,
  );
});

runTest('review workflow includes unreviewed inspections below 0.5 confidence', () => {
  const reviewedInspectionIds = new Set();

  assert.equal(
    isInspectionReviewable(buildInspection('inspection-2', 0.42), reviewedInspectionIds),
    true,
  );
});

runTest('review workflow excludes unreviewed inspections above 0.5 confidence', () => {
  const reviewedInspectionIds = new Set();

  assert.equal(
    isInspectionReviewable(buildInspection('inspection-3', 0.82), reviewedInspectionIds),
    false,
  );
});

runTest('review workflow excludes inspections with null confidence', () => {
  const reviewedInspectionIds = new Set();

  assert.equal(
    isInspectionReviewable(buildInspection('inspection-4', null), reviewedInspectionIds),
    false,
  );
});

runTest('review workflow excludes already reviewed inspections even when confidence is low', () => {
  const reviewedInspectionIds = new Set(['inspection-5']);

  assert.equal(
    isInspectionReviewable(buildInspection('inspection-5', 0.3), reviewedInspectionIds),
    false,
  );
});

runTest('confidence percentage formatting uses normalized confidence values', () => {
  assert.equal(formatConfidencePercentage(0.5), '50%');
  assert.equal(formatConfidencePercentage(0.82), '82%');
  assert.equal(formatConfidencePercentage(1), '100%');
});

runTest('confidence percentage formatting rejects null and invalid values', () => {
  assert.equal(formatConfidencePercentage(null), 'N/A');
  assert.equal(formatConfidencePercentage(undefined), 'N/A');
  assert.equal(formatConfidencePercentage(3), 'Invalid');
  assert.equal(formatConfidencePercentage(50), 'Invalid');
});

runTest('average confidence excludes invalid confidence values', () => {
  const inspections = [
    buildInspection('inspection-1', 0.5),
    buildInspection('inspection-2', 0.8),
    buildInspection('inspection-3', null),
    buildInspection('inspection-4', 3),
  ];

  assert.equal(calculateAverageConfidence(inspections), 0.65);
});

runTest('confidence distribution buckets use normalized values and include 0.5 in the low-confidence bucket', () => {
  const distribution = buildConfidenceDistribution([
    buildInspection('inspection-1', 0.5),
    buildInspection('inspection-2', 0.51),
    buildInspection('inspection-3', 0.7),
    buildInspection('inspection-4', 0.9),
    buildInspection('inspection-5', null),
    buildInspection('inspection-6', 50),
  ]);

  assert.deepEqual(
    distribution.map(({ key, value }) => ({ key, value })),
    [
      { key: 'reviewable', value: 1 },
      { key: 'watch', value: 1 },
      { key: 'strong', value: 1 },
      { key: 'high', value: 1 },
    ],
  );
});

runTest('pending review queue and count follow the low-confidence unreviewed rule', () => {
  const inspections = [
    buildInspection('inspection-1', 0.5),
    buildInspection('inspection-2', 0.2),
    buildInspection('inspection-3', 0.8),
    buildInspection('inspection-4', null),
    buildInspection('inspection-5', 0.3),
  ];
  const reviewedInspectionIds = new Set(['inspection-5']);

  assert.deepEqual(
    buildPendingReviewQueue(inspections, reviewedInspectionIds, 6).map((inspection) => inspection.id),
    ['inspection-1', 'inspection-2'],
  );
  assert.equal(countPendingReviewableInspections(inspections, reviewedInspectionIds), 2);
});

console.log('Frontend regression checks passed.');
