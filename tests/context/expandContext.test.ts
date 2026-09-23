import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildIndex } from '../../src/index/buildIndex.js';
import { expandContext } from '../../src/context/expandContext.js';

const execFileAsync = promisify(execFile);

async function repo() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'lean-expand-'));
  const root = path.join(base, 'repo');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'a.ts'), "import { b } from './b.js';\nimport { c } from './c.js';\nexport function a() { return b(); }\n");
  await writeFile(path.join(root, 'src', 'b.ts'), 'export function b() { return 2; }\n');
  await writeFile(path.join(root, 'src', 'c.ts'), 'export function c() { return 3; }\n');
  await writeFile(path.join(root, '.env'), 'TOKEN=secret');
  await writeFile(path.join(base, 'outside.ts'), 'secret');
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return { root, base };
}

test('expands local imports from an indexed file', async () => {
  const { root } = await repo();
  const index = await buildIndex({ root });
  const bundle = await expandContext(index, { relation: 'imports', path: 'src/a.ts' });
  assert.ok(bundle.chunks.some((chunk) => chunk.path === 'src/b.ts'));
});

test('file expansion cannot read secret files or escape the root', async () => {
  const { root } = await repo();
  const index = await buildIndex({ root });
  await assert.rejects(() => expandContext(index, { relation: 'file', path: '.env' }), /secret-like/i);
  await assert.rejects(() => expandContext(index, { relation: 'file', path: '../outside.ts' }), /outside repository root/i);
});


test('callers excludes the symbol declaration itself', async () => {
  const { root } = await repo();
  const index = await buildIndex({ root });
  const bundle = await expandContext(index, { relation: 'callers', symbol: 'b' });
  assert.ok(bundle.chunks.some((chunk) => chunk.path === 'src/a.ts'));
  assert.ok(!bundle.chunks.some((chunk) => chunk.path === 'src/b.ts'));
});

test('callees includes called local symbols but excludes unused imports', async () => {
  const { root } = await repo();
  const index = await buildIndex({ root });
  const bundle = await expandContext(index, { relation: 'callees', path: 'src/a.ts' });
  assert.ok(bundle.chunks.some((chunk) => chunk.path === 'src/b.ts'));
  assert.ok(!bundle.chunks.some((chunk) => chunk.path === 'src/c.ts'));
});
