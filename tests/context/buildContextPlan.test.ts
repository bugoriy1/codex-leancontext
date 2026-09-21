import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextPlan } from '../../src/context/buildContextPlan.js';
import type { RepositoryIndex } from '../../src/shared/types.js';

const index: RepositoryIndex = {
  root: '/repo', generatedAt: '2026-09-21T00:00:00.000Z', files: [
    { path: 'src/auth/session.ts', language: 'typescript', bytes: 1600, hash: '1', symbols: [
      { name: 'validateSession', kind: 'function', startLine: 1, endLine: 20, exported: true },
    ], imports: ['./policy.js'], exports: ['validateSession'], isTest: false },
    { path: 'src/auth/policy.ts', language: 'typescript', bytes: 800, hash: '2', symbols: [
      { name: 'PermissionPolicy', kind: 'class', startLine: 1, endLine: 15, exported: true },
    ], imports: [], exports: ['PermissionPolicy'], isTest: false },
    { path: 'tests/auth/session.test.ts', language: 'typescript', bytes: 900, hash: '3', symbols: [], imports: ['../../src/auth/session.js'], exports: [], isTest: true },
    { path: 'src/ui/theme.ts', language: 'typescript', bytes: 5000, hash: '4', symbols: [], imports: [], exports: [], isTest: false },
  ],
};

test('builds a focused plan and treats token budget as soft', () => {
  const plan = buildContextPlan(index, 'fix validateSession authentication permissions', { tokenBudget: 1 });
  assert.ok(plan.items.some((item) => item.path === 'src/auth/session.ts'));
  assert.ok(plan.estimatedTokens > 1);
  assert.ok(plan.confidence > 0.5);
});

test('returns low confidence instead of pretending an unrelated task is understood', () => {
  const plan = buildContextPlan(index, 'quantum banana frobnicator');
  assert.ok(plan.confidence < 0.55);
});
