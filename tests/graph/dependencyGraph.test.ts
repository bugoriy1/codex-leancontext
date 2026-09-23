import test from 'node:test';
import assert from 'node:assert/strict';
import { createDependencyGraph } from '../../src/graph/dependencyGraph.js';
import type { RepositoryIndex } from '../../src/shared/types.js';

const index: RepositoryIndex = {
  root: '/repo',
  generatedAt: '2026-09-21T00:00:00.000Z',
  files: [
    { path: 'src/a.ts', language: 'typescript', bytes: 1, hash: 'a', symbols: [], imports: ['./b.js'], exports: [], isTest: false },
    { path: 'src/b.ts', language: 'typescript', bytes: 1, hash: 'b', symbols: [], imports: ['./c.js'], exports: [], isTest: false },
    { path: 'src/c.ts', language: 'typescript', bytes: 1, hash: 'c', symbols: [], imports: [], exports: [], isTest: false },
  ],
};

test('resolves local imports and reverse importers', () => {
  const graph = createDependencyGraph(index);
  assert.deepEqual(graph.importsOf('src/a.ts'), ['src/b.ts']);
  assert.deepEqual(graph.importersOf('src/b.ts'), ['src/a.ts']);
  assert.deepEqual(graph.neighbors('src/a.ts', 2), ['src/b.ts', 'src/c.ts']);
});
