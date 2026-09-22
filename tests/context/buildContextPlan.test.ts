import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextPlan } from '../../src/context/buildContextPlan.js';
import type { RepositoryIndex } from '../../src/shared/types.js';

const symbol = (name: string) => ({ name, kind: 'function' as const, startLine: 1, endLine: 8, exported: true });
const file = (path: string, name: string, isTest = false, imports: string[] = []) => ({ path, language: 'typescript', bytes: 800, hash: path, symbols: [symbol(name)], imports, exports: [name], isTest });
const index: RepositoryIndex = { root: '/repo', generatedAt: '2026-01-01T00:00:00.000Z', files: [
  file('src/ledger/reconciler.ts', 'reconcileLedger'),
  file('tests/ledger/reconciler.test.ts', 'reconcileLedgerTest', true, ['../../src/ledger/reconciler.js']),
  file('tests/ledger/reconciler.integration.test.ts', 'reconcileLedgerIntegration', true, ['../../src/ledger/reconciler.js']),
  file('tests/unrelated/index.test.ts', 'indexTest', true, ['../../src/unrelated/index.js']),
  file('src/other/index.ts', 'otherIndex'),
  file('src/ledger/validator.ts', 'validateLedger'),
  file('src/ledger/writer.ts', 'writeLedger'),
  file('src/ledger/reader.ts', 'readLedger'),
  file('src/ledger/report.ts', 'reportLedger'),
] };

test('initial selection contains a strong local target and at most two related tests', () => {
  const plan = buildContextPlan(index, 'repair reconcileLedger', { tokenBudget: 4000 });
  assert.equal(plan.items[0]?.path, 'src/ledger/reconciler.ts');
  assert.ok(plan.items.some((item) => item.path === 'tests/ledger/reconciler.test.ts'));
  assert.ok(plan.items.filter((item) => item.path.includes('reconciler') && item.path.includes('test')).length <= 2);
  assert.ok(plan.items.some((item) => item.tier !== 'full'));
});

test('enforces the initial full-source cap', () => {
  const plan = buildContextPlan(index, 'reconcileLedger validateLedger writeLedger readLedger reportLedger', { tokenBudget: 10000 });
  assert.ok(plan.items.filter((item) => item.tier === 'full').length <= 2);
});

test('does not associate generic index files by loose basename', () => {
  const plan = buildContextPlan(index, 'repair otherIndex', { tokenBudget: 4000 });
  assert.ok(!plan.items.some((item) => item.path === 'tests/unrelated/index.test.ts'));
});

test('explicit test target gets useful full source and related tests stay bounded', () => {
  const plan = buildContextPlan(index, 'fix tests/ledger/reconciler.test.ts', { tokenBudget: 4000 });
  assert.equal(plan.items.find((item) => item.path === 'tests/ledger/reconciler.test.ts')?.tier, 'full');
  assert.ok(plan.items.filter((item) => item.path.includes('/tests/') || item.path.startsWith('tests/')).length <= 2);
});

test('small soft budget cannot explode initial context', () => {
  const plan = buildContextPlan(index, 'reconcileLedger validateLedger writeLedger readLedger reportLedger', { tokenBudget: 1 });
  assert.ok(plan.estimatedTokens < 10000);
  assert.ok(plan.items.length <= 2);
});

test('ambiguous common terms do not get high confidence or full retrieval', () => {
  const common: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [file('src/context/one.ts', 'contextOne'), file('src/context/two.ts', 'contextTwo'), file('src/context/three.ts', 'contextThree')] };
  const plan = buildContextPlan(common, 'update context');
  assert.ok(plan.confidence < 0.55);
  assert.ok(plan.items.every((item) => item.tier !== 'full'));
});

test('resolves same-basename tests by their full indexed import path and keeps index relations', () => {
  const paths: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [
    file('src/one/widget.ts', 'oneWidget'), file('src/two/widget.ts', 'twoWidget'),
    file('tests/two/widget.test.ts', 'twoWidgetTest', true, ['../../src/two/widget.js']),
    file('src/one/index.ts', 'oneIndex'), file('tests/one/index.test.ts', 'oneIndexTest', true, ['../../src/one/index.js']),
  ] };
  const widgetPlan = buildContextPlan(paths, 'repair twoWidget', { tokenBudget: 4000 });
  assert.ok(widgetPlan.items.some((item) => item.path === 'tests/two/widget.test.ts'));
  const indexPlan = buildContextPlan(paths, 'repair oneIndex', { tokenBudget: 4000 });
  assert.ok(indexPlan.items.some((item) => item.path === 'tests/one/index.test.ts'));
});

test('huge first source is downgraded under a tiny soft budget', () => {
  const huge: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [{ ...file('src/archive/hugeLedger.ts', 'hugeLedger'), bytes: 2_000_000 }] };
  const plan = buildContextPlan(huge, 'repair hugeLedger', { tokenBudget: 1 });
  assert.ok(plan.estimatedTokens < 10_000);
  assert.notEqual(plan.items[0]?.tier, 'full');
});

test('explicit symbol-less test remains useful without an empty symbol chunk', () => {
  const symbolLess: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [{ ...file('tests/ledger/plain.test.ts', 'placeholder', true), symbols: [] }] };
  const plan = buildContextPlan(symbolLess, 'fix tests/ledger/plain.test.ts', { tokenBudget: 4000 });
  const item = plan.items[0];
  assert.ok(item?.tier === 'full' || item?.tier === 'metadata');
  assert.equal(item?.symbols, undefined);
});

test('small soft budget retains a compact strongly relevant target', () => {
  const focused: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [file('src/invoice/matcher.ts', 'matchInvoice'), file('src/ui/theme.ts', 'setTheme')] };
  const strong = buildContextPlan(focused, 'repair matchInvoice', { tokenBudget: 1 });
  const unrelated = buildContextPlan(focused, 'quantum banana frobnicator', { tokenBudget: 1 });
  assert.ok(strong.items.some((item) => item.path === 'src/invoice/matcher.ts'));
  assert.ok(strong.items.length > 0);
  assert.ok(strong.confidence > unrelated.confidence);
});

test('completely unrelated tasks remain low confidence without arbitrary full source', () => {
  const plan = buildContextPlan(index, 'quantum banana frobnicator');
  assert.ok(plan.confidence < 0.55);
  assert.ok(plan.items.every((item) => item.tier !== 'full'));
});

test('many matching sources cannot add more than two automatic related tests', () => {
  const many: RepositoryIndex = { root: '/repo', generatedAt: 'now', files: [
    file('src/a/alpha.ts', 'alphaTask'), file('src/b/beta.ts', 'betaTask'), file('src/c/gamma.ts', 'gammaTask'),
    file('tests/a/alpha.test.ts', 'alphaTest', true, ['../../src/a/alpha.js']), file('tests/b/beta.test.ts', 'betaTest', true, ['../../src/b/beta.js']), file('tests/c/gamma.test.ts', 'gammaTest', true, ['../../src/c/gamma.js']),
  ] };
  const plan = buildContextPlan(many, 'repair alphaTask betaTask gammaTask', { tokenBudget: 10000 });
  assert.ok(plan.items.filter((item) => item.reasons.includes('related-test')).length <= 2);
});
