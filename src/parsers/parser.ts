import type { SymbolInfo } from '../shared/types.js';
import { parseTypeScript } from './typescriptParser.js';
import { parsePython } from './pythonParser.js';
import { parseGeneric } from './genericParser.js';

export interface ParsedSource {
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
}

export function parseSource(language: string, source: string): ParsedSource {
  if (language === 'typescript' || language === 'javascript') return parseTypeScript(source);
  if (language === 'python') return parsePython(source);
  return parseGeneric(source);
}
