import type { ParsedSource } from './parser.js';
import type { SymbolInfo, SymbolKind } from '../shared/types.js';

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

function findBlockEnd(source: string, startIndex: number, startLine: number): number {
  const open = source.indexOf('{', startIndex);
  if (open < 0) return startLine;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return lineNumberAt(source, i);
    }
  }
  return startLine;
}

const kindMap: Record<string, SymbolKind> = {
  function: 'function',
  class: 'class',
  interface: 'interface',
  type: 'type',
  const: 'variable',
  let: 'variable',
  var: 'variable',
};

export function parseTypeScript(source: string): ParsedSource {
  const imports = new Set<string>();
  const importRegex = /(?:\bimport\s+(?:[^'"\n]+?\s+from\s+)?|\bexport\s+[^'"\n]+?\s+from\s+)['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(importRegex)) {
    const value = match[1] ?? match[2];
    if (value) imports.add(value);
  }

  const symbols: SymbolInfo[] = [];
  const symbolRegex = /^(\s*)(export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  for (const match of source.matchAll(symbolRegex)) {
    if (match.index === undefined) continue;
    const startLine = lineNumberAt(source, match.index);
    const rawKind = match[3] ?? 'const';
    const kind = kindMap[rawKind] ?? 'variable';
    const name = match[4] ?? '';
    const endLine = ['function', 'class', 'interface'].includes(rawKind)
      ? findBlockEnd(source, match.index, startLine)
      : startLine;
    symbols.push({ name, kind, startLine, endLine, exported: Boolean(match[2]) });
  }

  const exports = new Set(symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name));
  const exportListRegex = /\bexport\s*{([^}]+)}/g;
  for (const match of source.matchAll(exportListRegex)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) exports.add(name);
    }
  }

  return { symbols, imports: [...imports], exports: [...exports] };
}
