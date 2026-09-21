import test from 'node:test';
import assert from 'node:assert/strict';
import { createDispatcher } from '../../src/mcp/server.js';

test('lists leancontext_context_plan as an MCP tool', async () => {
  const dispatch = createDispatcher();
  const response = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 1);
  const result = response.result as { tools: Array<{ name: string }> };
  assert.ok(result.tools.some((tool) => tool.name === 'leancontext_context_plan'));
});


test('initialize advertises only the legacy MCP version implemented by this server', async () => {
  const dispatch = createDispatcher();
  const response = await dispatch({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2026-07-28' } });
  const result = response.result as { protocolVersion: string };
  assert.equal(result.protocolVersion, '2025-06-18');
});
