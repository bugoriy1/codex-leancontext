import path from 'node:path';
import type { DependencyGraph } from '../graph/dependencyGraph.js';
import type { RepositoryIndex } from '../shared/types.js';
import { tokenize } from './tokenizeTask.js';

export interface RankedContextItem {
  path: string;
  score: number;
  directScore: number;
  reasons: string[];
}

export interface RankContextOptions {
  graph?: DependencyGraph;
  changedPaths?: string[];
}

function overlapCount(left: Set<string>, right: Iterable<string>): number {
  let count = 0;
  for (const value of new Set(right)) if (left.has(value)) count += 1;
  return count;
}

function tokenDocumentFrequency(index: RepositoryIndex): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const file of index.files) {
    const terms = new Set([...tokenize(file.path), ...file.symbols.flatMap((symbol) => tokenize(symbol.name)), ...file.exports.flatMap((name) => tokenize(name)), ...file.imports.flatMap((name) => tokenize(name))]);
    for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  return frequency;
}

function rarity(term: string, frequency: Map<string, number>, corpusSize: number): number {
  return Math.max(0, Math.log((corpusSize + 2) / ((frequency.get(term) ?? 0) + 1)));
}

function weightedOverlap(taskTokens: Set<string>, terms: Iterable<string>, frequency: Map<string, number>, corpusSize: number): number {
  let score = 0;
  for (const term of new Set(terms)) if (taskTokens.has(term)) score += rarity(term, frequency, corpusSize);
  return score;
}

export function rankContext(index: RepositoryIndex, task: string, options: RankContextOptions = {}): RankedContextItem[] {
  const taskTokens = new Set(tokenize(task));
  const changed = new Set(options.changedPaths ?? []);
  const scores = new Map<string, { score: number; directScore: number; reasons: string[] }>();
  const frequency = tokenDocumentFrequency(index);
  const corpusSize = Math.max(1, index.files.length);

  for (const file of index.files) {
    let directScore = 0;
    const reasons: string[] = [];
    const pathTerms = tokenize(file.path);
    const pathHits = overlapCount(taskTokens, pathTerms);
    if (pathHits > 0) { directScore += weightedOverlap(taskTokens, pathTerms, frequency, corpusSize) * 5; reasons.push(`path:${pathHits}`); }

    const symbolTerms = file.symbols.flatMap((symbol) => tokenize(symbol.name));
    const symbolHits = overlapCount(taskTokens, symbolTerms);
    if (symbolHits > 0) { directScore += weightedOverlap(taskTokens, symbolTerms, frequency, corpusSize) * 6; reasons.push(`symbol:${symbolHits}`); }

    const exportTerms = file.exports.flatMap((name) => tokenize(name));
    const exportHits = overlapCount(taskTokens, exportTerms);
    if (exportHits > 0) { directScore += weightedOverlap(taskTokens, exportTerms, frequency, corpusSize) * 2; reasons.push(`export:${exportHits}`); }

    const baseName = path.basename(file.path, path.extname(file.path)).toLowerCase();
    if (baseName !== 'index' && taskTokens.has(baseName)) { directScore += 1.5 + rarity(baseName, frequency, corpusSize) * 2; reasons.push('basename'); }

    let score = directScore;
    const importTerms = file.imports.flatMap((name) => tokenize(name));
    const importHits = overlapCount(taskTokens, importTerms);
    if (importHits > 0) { score += weightedOverlap(taskTokens, importTerms, frequency, corpusSize) * 0.6; reasons.push(`import:${importHits}`); }
    if (changed.has(file.path)) { score += 0.75; reasons.push('changed'); }
    scores.set(file.path, { score, directScore, reasons });
  }

  if (options.graph) {
    const directCandidates = [...scores.entries()].filter(([, value]) => value.directScore >= 5).sort(([, left], [, right]) => right.directScore - left.directScore);
    const strongestDirect = directCandidates[0]?.[1].directScore ?? 0;
    const anchors = directCandidates.filter(([, value]) => value.directScore >= strongestDirect * 0.5).slice(0, 2).map(([filePath]) => filePath);
    for (const anchor of anchors) {
      for (const dependency of options.graph.importsOf(anchor)) {
        const current = scores.get(dependency);
        if (current) { current.score += 1; current.reasons.push(`dependency:${anchor}`); }
      }
      for (const importer of options.graph.importersOf(anchor)) {
        const current = scores.get(importer);
        if (current) { current.score += 0.6; current.reasons.push(`importer:${anchor}`); }
      }
    }
  }

  return [...scores.entries()].map(([filePath, value]) => {
    const indirectCeiling = value.directScore === 0 ? 2 : Math.min(2, value.directScore * 0.25);
    return { path: filePath, ...value, score: Math.min(value.score, value.directScore + indirectCeiling) };
  }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
