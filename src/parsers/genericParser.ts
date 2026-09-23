import type { ParsedSource } from './parser.js';

export function parseGeneric(_source: string): ParsedSource {
  return { symbols: [], imports: [], exports: [] };
}
