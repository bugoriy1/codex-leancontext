import { createDependencyGraph } from '../graph/dependencyGraph.js';
import path from 'node:path';
import { relatedTests } from './relatedTests.js';
import { rankContext, type RankedContextItem } from '../ranking/rankContext.js';
import { tokenize } from '../ranking/tokenizeTask.js';
import { assessContextSafety } from '../safety/contextSafetyGuard.js';
import { estimateItemTokens } from '../tokens/estimateTokens.js';
import type { ContextPlan, ContextPlanItem, IndexedFile, RepositoryIndex } from '../shared/types.js';

export interface BuildContextPlanOptions { tokenBudget?: number; changedPaths?: string[]; }

function confidenceFromRanking(ranked: RankedContextItem[]): number {
  const top = ranked[0]?.directScore ?? 0; const next = ranked[1]?.directScore ?? 0; const margin = top - next;
  if (top >= 8 && margin >= 2) return 0.95; if (top >= 5 && margin >= 1) return 0.85; if (top >= 3 && margin >= 0.5) return 0.7; if (top >= 1.5 && margin > 0) return 0.5; return 0.2;
}
function tierFor(directScore: number, confidence: number): ContextPlanItem['tier'] { if (confidence >= 0.85 && directScore >= 8) return 'full'; if (directScore >= 2) return 'symbol'; return 'metadata'; }
function taskTargetsFile(task: string, file: IndexedFile): boolean { const lower = task.toLowerCase(); return lower.includes(file.path.toLowerCase()) || lower.includes(path.posix.basename(file.path).toLowerCase()); }
function downgrade(tier: ContextPlanItem['tier']): ContextPlanItem['tier'] { return tier === 'full' ? 'symbol' : 'metadata'; }

export function buildContextPlan(index: RepositoryIndex, task: string, options: BuildContextPlanOptions = {}): ContextPlan {
  const ranked = rankContext(index, task, { graph: createDependencyGraph(index), ...(options.changedPaths ? { changedPaths: options.changedPaths } : {}) });
  const confidence = confidenceFromRanking(ranked); const safety = assessContextSafety(task, confidence); const budget = options.tokenBudget ?? 6000; const overshoot = Math.max(256, budget * 4);
  const byPath = new Map(index.files.map((file) => [file.path, file])); const taskTokens = new Set(tokenize(task)); const items: ContextPlanItem[] = []; let estimatedTokens = 0;
  const fullLimit = safety.risk === 'elevated' ? 1 : 2; let relatedCount = 0;
  const candidates = ranked.filter((entry) => entry.score > 0 || safety.forceExpansion).sort((left, right) => {
    const explicitOrder = Number(taskTargetsFile(task, byPath.get(right.path)!)) - Number(taskTargetsFile(task, byPath.get(left.path)!));
    return explicitOrder || right.directScore - left.directScore || right.score - left.score;
  }).slice(0, safety.risk === 'elevated' ? 6 : 4);
  const add = (file: IndexedFile, rankedItem: RankedContextItem, related = false): boolean => {
    const existing = items.find((item) => item.path === file.path); const explicit = taskTargetsFile(task, file);
    const symbols = file.symbols.filter((symbol) => tokenize(symbol.name).some((token) => taskTokens.has(token))).map((symbol) => symbol.name);
    let tier = tierFor(rankedItem.directScore, confidence); const fullCount = items.filter((item) => item.tier === 'full').length;
    if (explicit && fullCount < fullLimit && file.bytes <= budget + overshoot) tier = 'full';
    if (tier === 'full' && fullCount >= fullLimit) tier = downgrade(tier); if (tier === 'symbol' && symbols.length === 0) tier = file.isTest && explicit && file.bytes <= budget + overshoot && fullCount < fullLimit ? 'full' : 'metadata';
    let planItem: ContextPlanItem = { path: file.path, tier, score: rankedItem.score, reasons: related ? ['related-test'] : [...rankedItem.reasons], ...(tier === 'symbol' ? { symbols: symbols.length ? symbols : file.symbols.slice(0, 3).map((symbol) => symbol.name) } : {}) };
    let cost = estimateItemTokens(file, planItem);
    while (tier !== 'metadata' && (cost > budget + overshoot || (items.length > 0 && estimatedTokens + cost > budget + overshoot))) { tier = downgrade(tier); planItem = { ...planItem, tier, ...(tier === 'symbol' ? { symbols: symbols.length ? symbols : file.symbols.slice(0, 3).map((symbol) => symbol.name) } : {}) }; if (tier !== 'symbol') delete planItem.symbols; cost = estimateItemTokens(file, planItem); }
    if (existing) { if (explicit && (existing.tier === 'metadata' || (existing.tier === 'symbol' && tier === 'full'))) { estimatedTokens -= estimateItemTokens(file, existing); Object.assign(existing, planItem); estimatedTokens += cost; return true; } return false; }
    if (items.length > 0 && estimatedTokens + cost > budget + overshoot) return false; items.push(planItem); estimatedTokens += cost; return true;
  };
  for (const rankedItem of candidates) {
    const file = byPath.get(rankedItem.path); if (!file) continue; const explicit = taskTargetsFile(task, file); if (file.isTest && !explicit) continue;
    if (!add(file, rankedItem)) continue;
    if (!file.isTest && relatedCount < 2) for (const testFile of relatedTests(index, file.path)) { if (relatedCount >= 2) break; if (add(testFile, rankedItem, true)) relatedCount += 1; }
  }
  return { task, confidence, estimatedTokens, items };
}
