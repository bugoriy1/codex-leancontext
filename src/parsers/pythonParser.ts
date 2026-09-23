import type { ParsedSource } from './parser.js';
import type { SymbolInfo } from '../shared/types.js';

export function parsePython(source: string): ParsedSource {
  const lines = source.split(/\r?\n/);
  const imports = new Set<string>();
  const symbols: SymbolInfo[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const importMatch = line.match(/^\s*import\s+([A-Za-z_][\w.]*)/);
    if (importMatch?.[1]) imports.add(importMatch[1]);
    const fromMatch = line.match(/^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+/);
    if (fromMatch?.[1]) imports.add(fromMatch[1]);

    const symbolMatch = line.match(/^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_][\w]*)/);
    if (!symbolMatch?.[2] || !symbolMatch[3]) continue;
    const indentation = symbolMatch[1]?.length ?? 0;
    let endLine = index + 1;
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next] ?? '';
      if (!candidate.trim()) { endLine = next + 1; continue; }
      const nextIndent = candidate.match(/^\s*/)?.[0].length ?? 0;
      if (nextIndent <= indentation) break;
      endLine = next + 1;
    }
    const name = symbolMatch[3];
    symbols.push({
      name,
      kind: symbolMatch[2] === 'class' ? 'class' : 'function',
      startLine: index + 1,
      endLine,
      exported: !name.startsWith('_'),
    });
  }

  return {
    symbols,
    imports: [...imports],
    exports: symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name),
  };
}
