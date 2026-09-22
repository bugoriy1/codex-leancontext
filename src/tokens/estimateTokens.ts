import type { ContextPlanItem, IndexedFile } from '../shared/types.js';

export function estimateItemTokens(file: IndexedFile, item: ContextPlanItem): number {
  if (item.tier === 'full') return Math.max(16, Math.ceil(file.bytes / 4));
  if (item.tier === 'symbol') return Math.max(48, Math.ceil(file.bytes / 4));
  return 36 + Math.min(file.symbols.length, 24) * 8 + Math.min(file.imports.length, 24) * 5 + Math.min(file.exports.length, 24) * 5;
}
