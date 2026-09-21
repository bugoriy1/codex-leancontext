import test from 'node:test';
import assert from 'node:assert/strict';
import { rankContext } from '../../src/ranking/rankContext.js';
import { createDependencyGraph } from '../../src/graph/dependencyGraph.js';
import type { RepositoryIndex } from '../../src/shared/types.js';

const index: RepositoryIndex = {
  root: '/repo', generatedAt: '2026-09-21T00:00:00.000Z', files: [
    { path: 'src/http/client.ts', language: 'typescript', bytes: 1200, hash: '1', symbols: [
      { name: 'HttpClient', kind: 'class', startLine: 1, endLine: 20, exported: true },
      { name: 'request', kind: 'function', startLine: 22, endLine: 30, exported: true },
    ], imports: ['./retry.js'], exports: ['HttpClient', 'request'], isTest: false },
    { path: 'src/http/retry.ts', language: 'typescript', bytes: 600, hash: '2', symbols: [
      { name: 'retryRequest', kind: 'function', startLine: 1, endLine: 8, exported: true },
    ], imports: [], exports: ['retryRequest'], isTest: false },
    { path: 'src/unrelated/theme.ts', language: 'typescript', bytes: 400, hash: '3', symbols: [], imports: [], exports: [], isTest: false },
  ],
};

test('ranks task-matching files first and carries dependency relevance', () => {
  const graph = createDependencyGraph(index);
  const ranked = rankContext(index, 'add retry to HttpClient request', { graph });
  assert.equal(ranked[0]?.path, 'src/http/client.ts');
  const retry = ranked.find((item) => item.path === 'src/http/retry.ts');
  assert.ok((retry?.score ?? 0) > 0);
  assert.ok(retry?.reasons.some((reason) => reason.includes('dependency')));
});

test('boosts changed files without making unrelated changed code dominant', () => {
  const ranked = rankContext(index, 'update HttpClient request', { changedPaths: ['src/unrelated/theme.ts'] });
  assert.equal(ranked[0]?.path, 'src/http/client.ts');
});
