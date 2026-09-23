import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildIndex } from '../../src/index/buildIndex.js';

const execFileAsync = promisify(execFile);

test('builds indexed file metadata with stable hashes and test detection', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-index-'));
  await mkdir(path.join(root, 'src'));
  await mkdir(path.join(root, 'tests'));
  await writeFile(path.join(root, 'src', 'main.ts'), "export function main() { return 1; }\n");
  await writeFile(path.join(root, 'tests', 'main.test.ts'), "import { main } from '../src/main.js';\nmain();\n");
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  const index = await buildIndex({ root, maxFileBytes: 1024 });
  const main = index.files.find((file) => file.path === 'src/main.ts');
  const testFile = index.files.find((file) => file.path === 'tests/main.test.ts');
  assert.equal(main?.language, 'typescript');
  assert.match(main?.hash ?? '', /^[a-f0-9]{64}$/);
  assert.ok(main?.symbols.some((symbol) => symbol.name === 'main'));
  assert.equal(testFile?.isTest, true);
});
