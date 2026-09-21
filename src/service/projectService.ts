import { buildIncrementalIndex } from '../index/buildIncrementalIndex.js';
import { buildContextPlan } from '../context/buildContextPlan.js';
import { getChangedPaths } from '../git/changedContext.js';
import type { ContextPlan, RepositoryIndex } from '../shared/types.js';

export interface ServiceOptions {
  dataRoot?: string;
}

export async function indexProject(root: string, options: ServiceOptions = {}) {
  return buildIncrementalIndex({ root, ...(options.dataRoot ? { dataRoot: options.dataRoot } : {}) });
}

export async function planProject(root: string, task: string, options: ServiceOptions & { tokenBudget?: number } = {}): Promise<{ index: RepositoryIndex; plan: ContextPlan; stats: { scanned: number; parsed: number; cacheHits: number } }> {
  const built = await indexProject(root, options);
  const changedPaths = await getChangedPaths(built.index.root);
  const plan = buildContextPlan(built.index, task, {
    changedPaths,
    ...(options.tokenBudget !== undefined ? { tokenBudget: options.tokenBudget } : {}),
  });
  return { index: built.index, plan, stats: built.stats };
}

export function tokenReport(index: RepositoryIndex, plan: ContextPlan) {
  const naiveTokens = index.files.reduce((sum, file) => sum + Math.max(1, Math.ceil(file.bytes / 4)), 0);
  const selectedTokens = plan.estimatedTokens;
  const savedTokens = Math.max(0, naiveTokens - selectedTokens);
  return {
    naiveTokens,
    selectedTokens,
    savedTokens,
    savedPercent: naiveTokens === 0 ? 0 : Math.round((savedTokens / naiveTokens) * 10000) / 100,
    totalFiles: index.files.length,
    selectedFiles: plan.items.length,
    filesAvoided: Math.max(0, index.files.length - plan.items.length),
    confidence: plan.confidence,
  };
}
