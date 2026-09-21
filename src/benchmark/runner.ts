import { performance } from 'node:perf_hooks';
import { planProject } from '../service/projectService.js';
import { compareBenchmarkRuns, type BenchmarkReport, type BenchmarkRun } from './report.js';

export interface PlanningBenchmarkOptions {
  dataRoot?: string;
  tokenBudget?: number;
}

export async function runPlanningBenchmark(root: string, task: string, options: PlanningBenchmarkOptions = {}): Promise<BenchmarkReport> {
  const started = performance.now();
  const planned = await planProject(root, task, options);
  const durationMs = Math.round(performance.now() - started);
  const naiveTokens = planned.index.files.reduce((sum, file) => sum + Math.max(1, Math.ceil(file.bytes / 4)), 0);

  const baseline: BenchmarkRun = {
    inputTokens: naiveTokens,
    cachedTokens: null,
    outputTokens: null,
    filesInspected: planned.index.files.length,
    turns: 0,
    durationMs,
    verificationPassed: null,
    measurement: 'estimated',
  };
  const leanContext: BenchmarkRun = {
    inputTokens: planned.plan.estimatedTokens,
    cachedTokens: null,
    outputTokens: null,
    filesInspected: planned.plan.items.length,
    turns: 0,
    durationMs,
    verificationPassed: null,
    measurement: 'estimated',
  };

  return {
    task,
    repositoryRoot: planned.index.root,
    baseline,
    leanContext,
    comparison: compareBenchmarkRuns(baseline, leanContext),
  };
}
