import path from 'node:path';
import type { DependencyGraph } from '../graph/dependencyGraph.js';
import type { RepositoryIndex } from '../shared/types.js';
import { tokenize } from './tokenizeTask.js';

export interface RankedContextItem {
  path: string;
  score: number;
  reasons: string[];
}

export interface RankContextOptions {
  graph?: DependencyGraph;
  changedPaths?: string[];
}

function overlapCount(left: Set<string>, right: Iterable<string>): number {
  let count = 0;
  for (const value of right) if (left.has(value)) count += 1;
  return count;
}

export function rankContext(index: RepositoryIndex, task: string, options: RankContextOptions = {}): RankedContextItem[] {
  const taskTokens = new Set(tokenize(task));
  const changed = new Set(options.changedPaths ?? []);
  const scores = new Map<string, { score: number; reasons: string[] }>();

  for (const file of index.files) {
    let score = 0;
    const reasons: string[] = [];
    const pathHits = overlapCount(taskTokens, tokenize(file.path));
    if (pathHits > 0) { score += pathHits * 2; reasons.push(`path:${pathHits}`); }

    let symbolHits = 0;
    for (const symbol of file.symbols) symbolHits += overlapCount(taskTokens, tokenize(symbol.name));
    if (symbolHits > 0) { score += symbolHits * 3; reasons.push(`symbol:${symbolHits}`); }

    const exportHits = overlapCount(taskTokens, file.exports.flatMap((name) => tokenize(name)));
    if (exportHits > 0) { score += exportHits * 2; reasons.push(`export:${exportHits}`); }

    const importHits = overlapCount(taskTokens, file.imports.flatMap((name) => tokenize(name)));
    if (importHits > 0) { score += importHits; reasons.push(`import:${importHits}`); }

    const baseName = path.basename(file.path, path.extname(file.path));
    if (taskTokens.has(baseName.toLowerCase())) { score += 2; reasons.push('basename'); }
    if (changed.has(file.path)) { score += 1.5; reasons.push('changed'); }
    scores.set(file.path, { score, reasons });
  }

  if (options.graph) {
    const anchors = [...scores.entries()].filter(([, value]) => value.score >= 4).map(([filePath]) => filePath);
    for (const anchor of anchors) {
      for (const dependency of options.graph.importsOf(anchor)) {
        const current = scores.get(dependency);
        if (current) { current.score += 2.5; current.reasons.push(`dependency:${anchor}`); }
      }
      for (const importer of options.graph.importersOf(anchor)) {
        const current = scores.get(importer);
        if (current) { current.score += 1.5; current.reasons.push(`importer:${anchor}`); }
      }
    }
  }

  return [...scores.entries()]
    .map(([filePath, value]) => ({ path: filePath, score: value.score, reasons: value.reasons }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
