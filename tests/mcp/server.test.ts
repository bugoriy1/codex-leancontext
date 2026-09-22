import test from 'node:test';
import assert from 'node:assert/strict';
import { createDispatcher } from '../../src/mcp/server.js';

test('default MCP surface exposes only lean context and expansion', async () => {
  const dispatch = createDispatcher();
  const response = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const tools = (response.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name).sort();
  assert.deepEqual(tools, ['leancontext_context', 'leancontext_expand']);
});

test('legacy tools require the compatibility flag', async () => {
  const oldValue = process.env.LEANCONTEXT_LEGACY_TOOLS;
  process.env.LEANCONTEXT_LEGACY_TOOLS = '1';
  try {
    const response = await createDispatcher()({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = (response.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
    assert.deepEqual(tools.sort(), ['leancontext_changed_context', 'leancontext_context', 'leancontext_context_plan', 'leancontext_expand', 'leancontext_get_context', 'leancontext_index', 'leancontext_token_report']);
  } finally {
    if (oldValue === undefined) delete process.env.LEANCONTEXT_LEGACY_TOOLS; else process.env.LEANCONTEXT_LEGACY_TOOLS = oldValue;
  }
});

test('initialize advertises the supported protocol and lean-first instructions', async () => {
  const response = await createDispatcher()({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: '2026-07-28' } });
  const result = response.result as { protocolVersion: string; instructions: string };
  assert.equal(result.protocolVersion, '2025-06-18');
  assert.match(result.instructions, /leancontext_context as the FIRST/i);
});

test('preserves JSON-RPC response envelope', async () => {
  const response = await createDispatcher()({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 4);
  assert.ok(response.result);
});
