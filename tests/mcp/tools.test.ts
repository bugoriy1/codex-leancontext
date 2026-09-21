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
  await execFileAsync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('lists all public LeanContext tools', async () => {
  const dispatch = createDispatcher();
  const response = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const tools = (response.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name).sort();
  assert.deepEqual(tools, [
    'leancontext_changed_context',
    'leancontext_context_plan',
    'leancontext_expand',
    'leancontext_get_context',
    'leancontext_index',
    'leancontext_token_report',
  ]);
});

test('indexes a repo then builds and retrieves a task plan by planId', async () => {
  const root = await repo();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'lean-mcp-data-'));
  const dispatch = createDispatcher({ dataRoot });
  const indexResponse = await dispatch({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'leancontext_index', arguments: { root } },
  });
  const indexed = (indexResponse.result as { structuredContent: { fileCount: number } }).structuredContent;
  assert.equal(indexed.fileCount, 1);

  const planResponse = await dispatch({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'leancontext_context_plan', arguments: { root, task: 'change greet function' } },
  });
  const planned = (planResponse.result as { structuredContent: { planId: string; plan: { items: Array<{ path: string }> } } }).structuredContent;
  assert.ok(planned.planId.length > 8);
  assert.ok(planned.plan.items.some((item) => item.path === 'src/greet.ts'));

  const contextResponse = await dispatch({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'leancontext_get_context', arguments: { planId: planned.planId } },
  });
  const context = (contextResponse.result as { structuredContent: { chunks: Array<{ path: string }> } }).structuredContent;
  assert.ok(context.chunks.some((chunk) => chunk.path === 'src/greet.ts'));
});
