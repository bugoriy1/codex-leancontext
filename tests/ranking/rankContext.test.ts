import test from 'node:test';
import assert from 'node:assert/strict';
import { rankContext } from '../../src/ranking/rankContext.js';
import { createDependencyGraph } from '../../src/graph/dependencyGraph.js';
import type { RepositoryIndex } from '../../src/shared/types.js';

const item = (path: string, symbol: string, imports: string[] = []) => ({ path, language: 'typescript', bytes: 800, hash: path, symbols: [{ name: symbol, kind: 'function' as const, startLine: 1, endLine: 5, exported: true }], imports, exports: [symbol], isTest: false });

test('strong local target outranks generic infrastructure hubs', () => {
  const index: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [
    item('src/ledger/reconciler.ts', 'reconcileLedger', ['../shared/contextHub.js']),
    item('src/context/buildContextPlan.ts', 'buildContextPlan', ['../shared/contextHub.js']),
    item('src/shared/contextHub.ts', 'contextHub'),
    item('src/ranking/rankContext.ts', 'rankContext'),
  ] };
  const ranked = rankContext(index, 'repair reconcileLedger context', { graph: createDependencyGraph(index) });
  assert.equal(ranked[0]?.path, 'src/ledger/reconciler.ts');
});

test('changed-only and import-only files cannot become graph anchors', () => {
  const index: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [
    item('src/ledger/reconciler.ts', 'reconcileLedger', ['../shared/hub.js']),
    item('src/shared/hub.ts', 'hub'),
    item('src/context/importOnly.ts', 'helper', ['../ledger/reconciler.js', '../shared/hub.js']),
    item('src/changed/notes.ts', 'notes', ['../shared/hub.js']),
  ] };
  const ranked = rankContext(index, 'repair reconcileLedger', { graph: createDependencyGraph(index), changedPaths: ['src/changed/notes.ts'] });
  assert.equal(ranked[0]?.path, 'src/ledger/reconciler.ts');
  assert.ok((ranked.find((entry) => entry.path === 'src/shared/hub.ts')?.score ?? 0) < (ranked[0]?.score ?? 0));
});

test('ubiquitous common terms remain ambiguous while unique symbols are direct', () => {
  const index: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [
    item('src/context/one.ts', 'contextOne'), item('src/context/two.ts', 'contextTwo'), item('src/context/three.ts', 'contextThree'),
  ] };
  const ranked = rankContext(index, 'update context');
  assert.ok((ranked[0]?.directScore ?? 0) < 4);
});

test('preserves positive dependency propagation for a strong direct target', () => {
  const index: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [item('src/http/client.ts', 'httpClient', ['./retry.js']), item('src/http/retry.ts', 'retryRequest')] };
  const ranked = rankContext(index, 'repair httpClient', { graph: createDependencyGraph(index) });
  assert.equal(ranked[0]?.path, 'src/http/client.ts');
  assert.ok(ranked.find((entry) => entry.path === 'src/http/retry.ts')?.reasons.some((reason) => reason.startsWith('dependency:')));
});

test('unrelated changed files cannot dominate a strong task match', () => {
  const index: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [item('src/invoice/matcher.ts', 'matchInvoice'), item('src/ui/theme.ts', 'setTheme')] };
  const ranked = rankContext(index, 'repair matchInvoice', { changedPaths: ['src/ui/theme.ts'] });
  assert.equal(ranked[0]?.path, 'src/invoice/matcher.ts');
  assert.ok((ranked.find((entry) => entry.path === 'src/ui/theme.ts')?.score ?? 0) < (ranked[0]?.score ?? 0));
});
