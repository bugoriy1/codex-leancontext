import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildIndex } from '../../src/index/buildIndex.js';
import { getContext } from '../../src/context/getContext.js';
import type { ContextPlan } from '../../src/shared/types.js';

const execFileAsync = promisify(execFile);

async function repo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-context-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'service.ts'), [
    "import { helper } from './helper.js';",
    'const before = 1;',
    'export function run(value: number) {',
    '  return helper(value);',
    '}',
    'const after = 2;',
  ].join('\n'));
  await writeFile(path.join(root, 'src', 'helper.ts'), 'export function helper(value: number) { return value + 1; }\n');
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('returns only selected symbol slice for symbol tier', async () => {
  const root = await repo();
  const index = await buildIndex({ root });
  const plan: ContextPlan = {
    task: 'change run', confidence: 0.9, estimatedTokens: 100, items: [
      { path: 'src/service.ts', tier: 'symbol', score: 5, reasons: ['symbol:1'], symbols: ['run'] },
    ],
  };
  const bundle = await getContext(index, plan);
  assert.equal(bundle.chunks.length, 1);
  assert.match(bundle.chunks[0]?.content ?? '', /function run/);
  assert.doesNotMatch(bundle.chunks[0]?.content ?? '', /const after/);
});

test('metadata tier exposes structure without source text', async () => {
  const root = await repo();
  const index = await buildIndex({ root });
  const plan: ContextPlan = {
    task: 'inspect', confidence: 0.7, estimatedTokens: 30, items: [
      { path: 'src/helper.ts', tier: 'metadata', score: 1, reasons: ['dependency'] },
    ],
  };
  const bundle = await getContext(index, plan);
  assert.equal(bundle.chunks[0]?.content, undefined);
  assert.ok(bundle.chunks[0]?.symbols.includes('helper'));
});


test('rejects source retrieval when the indexed file changed after planning', async () => {
  const root = await repo();
  const index = await buildIndex({ root });
  const plan: ContextPlan = {
    task: 'change run', confidence: 0.9, estimatedTokens: 100, items: [
      { path: 'src/service.ts', tier: 'symbol', score: 5, reasons: ['symbol:1'], symbols: ['run'] },
    ],
  };
  await writeFile(path.join(root, 'src', 'service.ts'), 'export function completelyDifferent() { return 99; }\n');
  await assert.rejects(() => getContext(index, plan), /index is stale/i);
});

test('downgrades an oversized symbol slice and caps metadata arrays', async () => {
  const root = await repo();
  await writeFile(path.join(root, 'src', 'huge.ts'), `export function huge() { return '${'x'.repeat(2_000_000)}'; }`);
  const index = await buildIndex({ root });
  const huge = index.files.find((file) => file.path === 'src/huge.ts')!;
  const mutated = { ...index, files: [{ ...huge, symbols: Array.from({ length: 100 }, (_, i) => ({ name: `symbol${i}`, kind: 'function' as const, startLine: 1, endLine: 1, exported: true })), imports: Array.from({ length: 100 }, (_, i) => `./dep${i}.js`), exports: Array.from({ length: 100 }, (_, i) => `symbol${i}`) }] };
  const bundle = await getContext(mutated, { task: 'huge', confidence: 0.9, estimatedTokens: 1, items: [{ path: 'src/huge.ts', tier: 'symbol', score: 1, reasons: [], symbols: ['symbol0'] }] });
  assert.equal(bundle.chunks[0]?.tier, 'metadata');
  assert.ok((bundle.chunks[0]?.symbols.length ?? 0) <= 24);
  assert.ok(bundle.estimatedTokens < 1_000);
});
