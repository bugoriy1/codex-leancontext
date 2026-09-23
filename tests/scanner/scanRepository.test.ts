import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRepository } from '../../src/scanner/scanRepository.js';

const execFileAsync = promisify(execFile);

async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'lean-scan-'));
  const root = path.join(base, 'repo');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await writeFile(path.join(root, 'src', 'app.ts'), 'export const ok = true;\n');
  await writeFile(path.join(root, 'node_modules', 'pkg', 'index.js'), 'vendor');
  await writeFile(path.join(root, 'dist', 'bundle.js'), 'generated');
  await writeFile(path.join(root, '.env'), 'TOKEN=secret');
  await writeFile(path.join(root, 'private.pem'), 'PRIVATE KEY');
  await writeFile(path.join(root, 'ignored.log'), 'ignored');
  await writeFile(path.join(root, 'huge.ts'), 'x'.repeat(200));
  await writeFile(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
  await writeFile(path.join(root, '.gitignore'), '*.log\n');
  const outside = path.join(base, 'outside.ts');
  await writeFile(outside, 'export const stolen = true;');
  await symlink(outside, path.join(root, 'escape.ts'));
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('includes source while excluding ignored, generated, secret, binary, oversized and escaping files', async () => {
  const root = await fixture();
  const files = await scanRepository({ root, maxFileBytes: 128 });
  const paths = files.map((file) => file.path).sort();
  assert.ok(paths.includes('src/app.ts'));
  for (const forbidden of ['ignored.log', '.env', 'private.pem', 'huge.ts', 'binary.bin', 'escape.ts', 'dist/bundle.js', 'node_modules/pkg/index.js']) {
    assert.ok(!paths.includes(forbidden), `expected ${forbidden} to be excluded`);
  }
});
