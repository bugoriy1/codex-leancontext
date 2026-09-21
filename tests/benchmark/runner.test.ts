import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runPlanningBenchmark } from '../../src/benchmark/runner.js';

const execFileAsync = promisify(execFile);

test('planning benchmark reports estimated savings without claiming quality verification', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-bench-repo-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'target.ts'), 'export function retryRequest() { return true; }\n');
  for (let i = 0; i < 8; i += 1) await writeFile(path.join(root, 'src', `unrelated-${i}.ts`), `export const value${i} = '${'x'.repeat(400)}';\n`);
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-bench-data-'));
  const report = await runPlanningBenchmark(root, 'change retryRequest', { dataRoot });
  assert.equal(report.baseline.measurement, 'estimated');
  assert.equal(report.leanContext.measurement, 'estimated');
  assert.equal(report.comparison.tokenReduced, true);
  assert.equal(report.comparison.releaseGatePassed, false);
});
