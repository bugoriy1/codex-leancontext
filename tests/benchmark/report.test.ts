import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBenchmarkRuns } from '../../src/benchmark/report.js';

test('passes the release gate only for actual lower-token runs with preserved verification', () => {
  const comparison = compareBenchmarkRuns(
    { inputTokens: 10000, cachedTokens: 0, outputTokens: 500, filesInspected: 20, turns: 8, durationMs: 1000, verificationPassed: true, measurement: 'actual' },
    { inputTokens: 6000, cachedTokens: 0, outputTokens: 500, filesInspected: 8, turns: 6, durationMs: 900, verificationPassed: true, measurement: 'actual' },
  );
  assert.equal(comparison.tokenReduced, true);
  assert.equal(comparison.qualityPreserved, true);
  assert.equal(comparison.releaseGatePassed, true);
  assert.equal(comparison.savedPercent, 40);
});

test('rejects a lower-token result when verification regresses', () => {
  const comparison = compareBenchmarkRuns(
    { inputTokens: 10000, cachedTokens: null, outputTokens: 500, filesInspected: 20, turns: 8, durationMs: 1000, verificationPassed: true, measurement: 'actual' },
    { inputTokens: 4000, cachedTokens: null, outputTokens: 500, filesInspected: 4, turns: 4, durationMs: 700, verificationPassed: false, measurement: 'actual' },
  );
  assert.equal(comparison.tokenReduced, true);
  assert.equal(comparison.qualityPreserved, false);
  assert.equal(comparison.releaseGatePassed, false);
});

test('estimated context savings never satisfy the actual benchmark release gate', () => {
  const comparison = compareBenchmarkRuns(
    { inputTokens: 10000, cachedTokens: null, outputTokens: null, filesInspected: 20, turns: 0, durationMs: 0, verificationPassed: null, measurement: 'estimated' },
    { inputTokens: 3000, cachedTokens: null, outputTokens: null, filesInspected: 5, turns: 0, durationMs: 0, verificationPassed: null, measurement: 'estimated' },
  );
  assert.equal(comparison.savedPercent, 70);
  assert.equal(comparison.releaseGatePassed, false);
});


test('never passes quality or release gate when the baseline verification itself failed', () => {
  const comparison = compareBenchmarkRuns(
    { inputTokens: 10000, cachedTokens: null, outputTokens: 500, filesInspected: 20, turns: 8, durationMs: 1000, verificationPassed: false, measurement: 'actual' },
    { inputTokens: 4000, cachedTokens: null, outputTokens: 500, filesInspected: 4, turns: 4, durationMs: 700, verificationPassed: false, measurement: 'actual' },
  );
  assert.equal(comparison.qualityPreserved, false);
  assert.equal(comparison.releaseGatePassed, false);
});
