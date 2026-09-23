import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildIncrementalIndex } from '../../src/index/buildIncrementalIndex.js';
import { cacheFilePath } from '../../src/cache/cachePaths.js';

const execFileAsync = promisify(execFile);

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-cache-repo-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  await writeFile(path.join(root, 'src', 'b.ts'), 'export const b = 2;\n');
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('reuses unchanged indexed metadata and reparses only changed files', async () => {
  const root = await makeRepo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-cache-data-'));
  const first = await buildIncrementalIndex({ root, dataRoot });
  assert.equal(first.stats.parsed, 2);
  assert.equal(first.stats.cacheHits, 0);

  const second = await buildIncrementalIndex({ root, dataRoot });
  assert.equal(second.stats.parsed, 0);
  assert.equal(second.stats.cacheHits, 2);

  await writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 3;\n');
  const third = await buildIncrementalIndex({ root, dataRoot });
  assert.equal(third.stats.parsed, 1);
  assert.equal(third.stats.cacheHits, 1);
});

test('corrupt cache is ignored and rebuilt safely', async () => {
  const root = await makeRepo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-cache-corrupt-'));
  await buildIncrementalIndex({ root, dataRoot });
  await writeFile(await cacheFilePath(root, dataRoot), '{broken json');
  const rebuilt = await buildIncrementalIndex({ root, dataRoot });
  assert.equal(rebuilt.index.files.length, 2);
  assert.equal(rebuilt.stats.parsed, 2);
});
