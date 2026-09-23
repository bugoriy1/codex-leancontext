import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDispatcher } from '../../src/mcp/server.js';

const execFileAsync = promisify(execFile);
async function repo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lean-mcp-repo-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'greet.ts'), 'export function greet(name: string) { return `hi ${name}`; }\n');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ engines: { node: '>=22' }, type: 'module' }));
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('one-call context gives content-only clients useful compact source without payload duplication', async () => {
  const root = await repo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-mcp-data-'));
  const response = await createDispatcher({ dataRoot })({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'leancontext_context', arguments: { root, task: 'change greet function' } } });
  const result = response.result as { content: Array<{ text: string }>; structuredContent?: unknown };
  assert.equal(result.structuredContent, undefined);
  assert.equal(result.content.length, 1);
  const payload = JSON.parse(result.content[0]?.text ?? '{}') as { planId?: string; estimatedTokens: number; projectConstraints: { node?: string; module?: string; runtimeDependencies?: string }; context: Array<{ path: string; tier: string; content?: string; symbols?: unknown }> };
  assert.equal(payload.planId, undefined);
  assert.ok(payload.estimatedTokens > 0);
  assert.deepEqual(payload.projectConstraints, { node: '>=22', module: 'esm', runtimeDependencies: 'none; do not add unless task requires' });
  assert.ok(JSON.stringify(payload.projectConstraints).length < 120);
  assert.doesNotMatch(result.content[0]?.text ?? '', /Codex LeanContext|README\.md/);
  const chunk = payload.context.find((candidate) => candidate.path === 'src/greet.ts');
  assert.match(chunk?.content ?? '', /function greet/);
  assert.ok(chunk?.tier === 'full' || Array.isArray(chunk?.symbols));
});

test('legacy context-plan and get-context execute only with compatibility flag', async () => {
  const oldValue = process.env.LEANCONTEXT_LEGACY_TOOLS;
  process.env.LEANCONTEXT_LEGACY_TOOLS = '1';
  try {
    const root = await repo();
    const dispatch = createDispatcher({ dataRoot: await mkdtemp(path.join(os.tmpdir(), 'lean-mcp-data-')) });
    const indexed = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'leancontext_index', arguments: { root } } });
    assert.equal((JSON.parse(((indexed.result as { content: Array<{ text: string }> }).content[0]?.text ?? '{}')) as { fileCount: number }).fileCount, 2);
    const planned = await dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'leancontext_context_plan', arguments: { root, task: 'change greet' } } });
    const planId = (JSON.parse(((planned.result as { content: Array<{ text: string }> }).content[0]?.text ?? '{}')) as { planId: string }).planId;
    assert.ok(planId.length > 8);
    const context = await dispatch({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'leancontext_get_context', arguments: { planId } } });
    assert.match((context.result as { content: Array<{ text: string }> }).content[0]?.text ?? '', /src\/greet.ts/);
  } finally { if (oldValue === undefined) delete process.env.LEANCONTEXT_LEGACY_TOOLS; else process.env.LEANCONTEXT_LEGACY_TOOLS = oldValue; }
});
