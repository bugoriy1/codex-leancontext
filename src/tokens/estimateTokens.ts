import type { ContextPlanItem, IndexedFile } from '../shared/types.js';

export function estimateItemTokens(file: IndexedFile, item: ContextPlanItem): number {
  if (item.tier === 'full') return Math.max(16, Math.ceil(file.bytes / 4));
  if (item.tier === 'symbol') return Math.max(48, (item.symbols?.length ?? 1) * 90);
  return 36 + file.symbols.length * 8 + file.imports.length * 5;
}
