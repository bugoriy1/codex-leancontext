export type BenchmarkMeasurement = 'actual' | 'estimated';

export interface BenchmarkRun {
  inputTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  filesInspected: number;
  turns: number;
  durationMs: number;
  verificationPassed: boolean | null;
  measurement: BenchmarkMeasurement;
}

export interface BenchmarkComparison {
  tokenReduced: boolean;
  qualityPreserved: boolean | null;
  savedTokens: number | null;
  savedPercent: number | null;
  releaseGatePassed: boolean;
}

export interface BenchmarkReport {
  task: string;
  repositoryRoot: string;
  baseline: BenchmarkRun;
  leanContext: BenchmarkRun;
  comparison: BenchmarkComparison;
}

export function compareBenchmarkRuns(baseline: BenchmarkRun, leanContext: BenchmarkRun): BenchmarkComparison {
  const tokenKnown = baseline.inputTokens !== null && leanContext.inputTokens !== null;
  const tokenReduced = tokenKnown && (leanContext.inputTokens as number) < (baseline.inputTokens as number);
  const savedTokens = tokenKnown ? Math.max(0, (baseline.inputTokens as number) - (leanContext.inputTokens as number)) : null;
  const savedPercent = tokenKnown && (baseline.inputTokens as number) > 0
    ? Math.round(((savedTokens as number) / (baseline.inputTokens as number)) * 10000) / 100
    : null;
  const qualityPreserved = baseline.verificationPassed === null || leanContext.verificationPassed === null
    ? null
    : baseline.verificationPassed === true && leanContext.verificationPassed === true;
  const actual = baseline.measurement === 'actual' && leanContext.measurement === 'actual';
  return {
    tokenReduced,
    qualityPreserved,
    savedTokens,
    savedPercent,
    releaseGatePassed: actual && tokenReduced && qualityPreserved === true,
  };
}
