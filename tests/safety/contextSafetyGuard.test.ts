import test from 'node:test';
import assert from 'node:assert/strict';
import { assessContextSafety } from '../../src/safety/contextSafetyGuard.js';

test('forces broader context for authentication and permission changes', () => {
  const decision = assessContextSafety('change authentication permission validation', 0.95);
  assert.equal(decision.risk, 'elevated');
  assert.equal(decision.forceExpansion, true);
  assert.ok(decision.minimumConfidence >= 0.75);
});

test('forces expansion when ordinary retrieval confidence is weak', () => {
  const decision = assessContextSafety('rename widget label', 0.2);
  assert.equal(decision.risk, 'normal');
  assert.equal(decision.forceExpansion, true);
});
