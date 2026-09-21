import { createDependencyGraph } from '../graph/dependencyGraph.js';
import { rankContext } from '../ranking/rankContext.js';
import { tokenize } from '../ranking/tokenizeTask.js';
import { assessContextSafety } from '../safety/contextSafetyGuard.js';
import { estimateItemTokens } from '../tokens/estimateTokens.js';
import type { ContextPlan, ContextPlanItem, RepositoryIndex } from '../shared/types.js';

export interface BuildContextPlanOptions {
  tokenBudget?: number;
  changedPaths?: string[];
}

function confidenceFromScore(topScore: number): number {
  if (topScore >= 10) return 0.95;
  if (topScore >= 7) return 0.85;
  if (topScore >= 4) return 0.7;
  if (topScore >= 2) return 0.5;
  if (topScore > 0) return 0.35;
  return 0.1;
}

function tierFor(score: number): ContextPlanItem['tier'] {
  if (score >= 8) return 'full';
  if (score >= 3) return 'symbol';
  return 'metadata';
}

export function buildContextPlan(index: RepositoryIndex, task: string, options: BuildContextPlanOptions = {}): ContextPlan {
  const graph = createDependencyGraph(index);
  const ranked = rankContext(index, task, { graph, ...(options.changedPaths ? { changedPaths: options.changedPaths } : {}) });
  const confidence = confidenceFromScore(ranked[0]?.score ?? 0);
  const safety = assessContextSafety(task, confidence);
  const budget = options.tokenBudget ?? 6000;
  const taskTokens = new Set(tokenize(task));
  const byPath = new Map(index.files.map((file) => [file.path, file]));
  const items: ContextPlanItem[] = [];
  let estimatedTokens = 0;

  const candidates = ranked.filter((item) => item.score > 0 || safety.forceExpansion).slice(0, safety.risk === 'elevated' ? 12 : 8);
  for (const rankedItem of candidates) {
    const file = byPath.get(rankedItem.path);
    if (!file) continue;
    const tier = tierFor(rankedItem.score);
    const matchingSymbols = file.symbols
      .filter((symbol) => tokenize(symbol.name).some((token) => taskTokens.has(token)))
      .map((symbol) => symbol.name);
    const planItem: ContextPlanItem = {
      path: file.path,
      tier,
      score: rankedItem.score,
      reasons: [...rankedItem.reasons],
      ...(tier === 'symbol' ? { symbols: matchingSymbols.length > 0 ? matchingSymbols : file.symbols.slice(0, 3).map((symbol) => symbol.name) } : {}),
    };
    const itemTokens = estimateItemTokens(file, planItem);
    const minimumItems = safety.risk === 'elevated' ? 3 : 1;
    if (items.length >= minimumItems && estimatedTokens + itemTokens > budget) break;
    items.push(planItem);
    estimatedTokens += itemTokens;
  }

  return { task, confidence, estimatedTokens, items };
}
