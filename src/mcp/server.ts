import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { expandContext } from '../context/expandContext.js';
import { getContext } from '../context/getContext.js';
import { projectConstraints } from '../context/projectConstraints.js';
import { getChangedPaths } from '../git/changedContext.js';
import { indexProject, planProject, tokenReport } from '../service/projectService.js';
import type { ContextPlan, ExpansionRelation, RepositoryIndex } from '../shared/types.js';
import { assessContextSafety } from '../safety/contextSafetyGuard.js';
import type { ContextBundle, ContextChunk } from '../shared/types.js';

type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface DispatcherOptions {
  dataRoot?: string;
}

interface StoredPlan {
  index: RepositoryIndex;
  plan: ContextPlan;
}

const leanTools = [
  {
    name: 'leancontext_context',
    description: 'First repository-inspection action: index, plan, and return compact initial context in one call. Expand whenever correctness requires it.',
    inputSchema: { type: 'object', properties: { root: { type: 'string' }, task: { type: 'string' }, tokenBudget: { type: 'number' } }, required: ['root', 'task'], additionalProperties: false },
  },
  {
    name: 'leancontext_expand',
    description: 'Expand context when the initial context is insufficient.',
    inputSchema: { type: 'object', properties: { root: { type: 'string' }, relation: { type: 'string', enum: ['callers', 'callees', 'imports', 'importers', 'tests', 'directory', 'symbol', 'file'] }, path: { type: 'string' }, symbol: { type: 'string' } }, required: ['root', 'relation'], additionalProperties: false },
  },
] as const;

const legacyTools = [
  {
    name: 'leancontext_index',
    description: 'Create or incrementally refresh the local repository metadata index. Source code is not stored in the cache.',
    inputSchema: { type: 'object', properties: { root: { type: 'string' } }, required: ['root'], additionalProperties: false },
  },
  {
    name: 'leancontext_context_plan',
    description: 'Build a minimal task-aware context plan. This is a starting point, never a hard boundary; expand whenever correctness needs more information.',
    inputSchema: { type: 'object', properties: { root: { type: 'string' }, task: { type: 'string' }, tokenBudget: { type: 'number' } }, required: ['root', 'task'], additionalProperties: false },
  },
  {
    name: 'leancontext_get_context',
    description: 'Retrieve source/metadata for a previously created planId without sending the whole plan back through model context.',
    inputSchema: { type: 'object', properties: { planId: { type: 'string' } }, required: ['planId'], additionalProperties: false },
  },
  {
    name: 'leancontext_expand',
    description: 'Expand context by file, symbol, imports, importers, tests, directory, callers, or callees. Use this whenever the plan is insufficient.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string' },
        relation: { type: 'string', enum: ['callers', 'callees', 'imports', 'importers', 'tests', 'directory', 'symbol', 'file'] },
        path: { type: 'string' },
        symbol: { type: 'string' },
      },
      required: ['root', 'relation'],
      additionalProperties: false,
    },
  },
  {
    name: 'leancontext_changed_context',
    description: 'Return changed repository paths relative to a Git ref or the current working tree.',
    inputSchema: { type: 'object', properties: { root: { type: 'string' }, base: { type: 'string' } }, required: ['root'], additionalProperties: false },
  },
  {
    name: 'leancontext_token_report',
    description: 'Compare estimated naive full-repository context with the selected context for a planId.',
    inputSchema: { type: 'object', properties: { planId: { type: 'string' } }, required: ['planId'], additionalProperties: false },
  },
] as const;

function toolResult(data: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    isError: false,
  };
}

function compactChunk(chunk: ContextChunk) {
  if (chunk.tier === 'full') return { path: chunk.path, tier: chunk.tier, content: chunk.content };
  if (chunk.tier === 'symbol') return { path: chunk.path, tier: chunk.tier, symbols: chunk.symbols, content: chunk.content };
  return { path: chunk.path, tier: chunk.tier, symbols: chunk.symbols, imports: chunk.imports, exports: chunk.exports };
}

function compactBundle(bundle: ContextBundle) {
  return { estimatedTokens: bundle.estimatedTokens, chunks: bundle.chunks.map(compactChunk) };
}

function exposedTools() { return process.env.LEANCONTEXT_LEGACY_TOOLS === '1' ? [...leanTools, ...legacyTools.filter((tool) => tool.name !== 'leancontext_expand')] : leanTools; }

function toolError(message: string) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export function createDispatcher(options: DispatcherOptions = {}) {
  const plans = new Map<string, StoredPlan>();

  return async (request: JsonRpcRequest): Promise<JsonRpcResponse> => {
    const id = request.id ?? null;

    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'codex-leancontext', version: '0.1.0' },
          instructions: 'Use leancontext_context as the FIRST repository-inspection action. Do not run broad rg/find/cat exploration before it unless the tool fails or its context is insufficient. Expand whenever correctness requires it. Never trade correctness for token savings.',
        },
      };
    }

    if (request.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (request.method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: exposedTools() } };

    if (request.method === 'tools/call') {
      const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const name = params?.name ?? '';
      const args = params?.arguments ?? {};
      try {
        if (name === 'leancontext_context') {
          const root = String(args.root ?? '');
          const task = String(args.task ?? '');
          const tokenBudget = typeof args.tokenBudget === 'number' ? args.tokenBudget : undefined;
          const planned = await planProject(root, task, { ...options, ...(tokenBudget !== undefined ? { tokenBudget } : {}) });
          const safety = assessContextSafety(task, planned.plan.confidence);
          const context = compactBundle(await getContext(planned.index, planned.plan));
          return { jsonrpc: '2.0', id, result: toolResult({ confidence: planned.plan.confidence, safetyRisk: safety.risk, projectConstraints: await projectConstraints(planned.index.root), estimatedTokens: context.estimatedTokens, context: context.chunks }) };
        }
        if (name !== 'leancontext_expand' && process.env.LEANCONTEXT_LEGACY_TOOLS !== '1') return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
        if (name === 'leancontext_index') {
          const root = String(args.root ?? '');
          const built = await indexProject(root, options);
          return { jsonrpc: '2.0', id, result: toolResult({ root: built.index.root, fileCount: built.index.files.length, stats: built.stats }) };
        }
        if (name === 'leancontext_context_plan') {
          const root = String(args.root ?? '');
          const task = String(args.task ?? '');
          const tokenBudget = typeof args.tokenBudget === 'number' ? args.tokenBudget : undefined;
          const planned = await planProject(root, task, { ...options, ...(tokenBudget !== undefined ? { tokenBudget } : {}) });
          const planId = randomUUID();
          plans.set(planId, { index: planned.index, plan: planned.plan });
          return { jsonrpc: '2.0', id, result: toolResult({ planId, plan: planned.plan, cache: planned.stats }) };
        }
        if (name === 'leancontext_get_context') {
          const planId = String(args.planId ?? '');
          const stored = plans.get(planId);
          if (!stored) return { jsonrpc: '2.0', id, result: toolError(`Unknown or expired planId: ${planId}`) };
          return { jsonrpc: '2.0', id, result: toolResult(compactBundle(await getContext(stored.index, stored.plan))) };
        }
        if (name === 'leancontext_expand') {
          const root = String(args.root ?? '');
          const relation = String(args.relation ?? '') as ExpansionRelation;
          const built = await indexProject(root, options);
          const requestArgs = {
            relation,
            ...(typeof args.path === 'string' ? { path: args.path } : {}),
            ...(typeof args.symbol === 'string' ? { symbol: args.symbol } : {}),
          };
          return { jsonrpc: '2.0', id, result: toolResult(compactBundle(await expandContext(built.index, requestArgs))) };
        }
        if (name === 'leancontext_changed_context') {
          const root = String(args.root ?? '');
          const base = typeof args.base === 'string' ? args.base : undefined;
          return { jsonrpc: '2.0', id, result: toolResult({ paths: await getChangedPaths(root, base) }) };
        }
        if (name === 'leancontext_token_report') {
          const planId = String(args.planId ?? '');
          const stored = plans.get(planId);
          if (!stored) return { jsonrpc: '2.0', id, result: toolError(`Unknown or expired planId: ${planId}`) };
          return { jsonrpc: '2.0', id, result: toolResult(tokenReport(stored.index, stored.plan)) };
        }
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { jsonrpc: '2.0', id, result: toolError(message) };
      }
    }

    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${request.method}` } };
  };
}

async function runStdio(): Promise<void> {
  const dispatch = createDispatcher();
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      continue;
    }
    if (request.id === undefined) continue;
    process.stdout.write(`${JSON.stringify(await dispatch(request))}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runStdio();
