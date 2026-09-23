import test from 'node:test';
import assert from 'node:assert/strict';
import { assessContextSafety } from '../../src/safety/contextSafetyGuard.js';

test('forces broader context for authentication and permission changes', () => {
  const decision = assessContextSafety('change authentication permission validation', 0.95);
  assert.deepEqual(decision, { risk: 'elevated', minimumConfidence: 0.78, forceExpansion: true, reasons: ['authentication', 'permissions'] });
});

test('forces expansion when ordinary retrieval confidence is weak', () => {
  const decision = assessContextSafety('rename widget label', 0.2);
  assert.deepEqual(decision, { risk: 'normal', minimumConfidence: 0.55, forceExpansion: true, reasons: ['low-confidence'] });
});

test('preserves existing elevated classifications', () => {
  for (const task of ['change authorization', 'rotate secrets', 'perform schema migration', 'change public API', 'fix concurrency', 'perform dependency upgrade']) {
    assert.equal(assessContextSafety(task, 0.95).risk, 'elevated');
  }
});
