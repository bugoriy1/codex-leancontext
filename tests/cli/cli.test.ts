import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/main.js';

const execFileAsync = promisify(execFile);

async function repo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-cli-repo-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'math.ts'), 'export function add(a: number, b: number) { return a + b; }\n');
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('CLI index emits machine-readable repository stats', async () => {
  const root = await repo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-cli-data-'));
  let output = '';
  const code = await runCli(['index', root], { out: (value) => { output += value; }, err: () => {} }, { dataRoot });
  assert.equal(code, 0);
  const parsed = JSON.parse(output) as { fileCount: number };
  assert.equal(parsed.fileCount, 1);
});

test('CLI context emits a focused context plan', async () => {
  const root = await repo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-cli-context-'));
  let output = '';
  const code = await runCli(['context', 'change add function', root], { out: (value) => { output += value; }, err: () => {} }, { dataRoot });
  assert.equal(code, 0);
  const parsed = JSON.parse(output) as { items: Array<{ path: string }> };
  assert.ok(parsed.items.some((item) => item.path === 'src/math.ts'));
});

test('CLI benchmark labels planning-only savings as estimated', async () => {
  const root = await repo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-cli-benchmark-'));
  let output = '';
  const code = await runCli(['benchmark', 'change add function', root], { out: (value) => { output += value; }, err: () => {} }, { dataRoot });
  assert.equal(code, 0);
  const parsed = JSON.parse(output) as { baseline: { measurement: string }; comparison: { releaseGatePassed: boolean } };
  assert.equal(parsed.baseline.measurement, 'estimated');
  assert.equal(parsed.comparison.releaseGatePassed, false);
});


test('compiled CLI has a Node shebang for npm bin execution', async () => {
  const compiled = await readFile(path.join(process.cwd(), 'dist', 'src', 'cli', 'main.js'), 'utf8');
  assert.ok(compiled.startsWith('#!/usr/bin/env node\n'));
});


test('CLI executes when invoked through an npm-style symlink', async () => {
  const root = await repo();
  const binDir = await mkdtemp(path.join(os.tmpdir(), 'lean-cli-bin-'));
  const compiledCli = path.join(process.cwd(), 'dist', 'src', 'cli', 'main.js');
  await chmod(compiledCli, 0o755);
  const bin = path.join(binDir, 'leancontext');
  await symlink(compiledCli, bin);
  const { stdout } = await execFileAsync(bin, ['index', root]);
  const parsed = JSON.parse(stdout) as { fileCount: number };
  assert.equal(parsed.fileCount, 1);
});
