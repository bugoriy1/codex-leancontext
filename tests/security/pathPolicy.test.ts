import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveInsideRoot } from '../../src/security/pathPolicy.js';

test('rejects lexical path traversal outside repository root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-root-'));
  await assert.rejects(() => resolveInsideRoot(root, '../outside.txt'), /outside repository root/i);
});

test('rejects symlink whose real target escapes repository root', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'lean-symlink-'));
  const root = path.join(base, 'repo');
  await mkdir(root);
  const outside = path.join(base, 'outside.txt');
  await writeFile(outside, 'secret');
  await symlink(outside, path.join(root, 'escape.txt'));
  await assert.rejects(() => resolveInsideRoot(root, 'escape.txt'), /outside repository root/i);
});
