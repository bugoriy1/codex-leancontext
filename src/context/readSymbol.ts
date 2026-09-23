import { readFile } from 'node:fs/promises';
import { resolveInsideRoot } from '../security/pathPolicy.js';
import { isSecretLikePath } from '../security/secretPatterns.js';
import type { IndexedFile } from '../shared/types.js';

export async function readSymbol(root: string, file: IndexedFile, symbolName: string, source?: string): Promise<string> {
  if (isSecretLikePath(file.path)) throw new Error('Refusing to read secret-like path');
  const absolute = await resolveInsideRoot(root, file.path);
  const symbol = file.symbols.find((candidate) => candidate.name === symbolName);
  if (!symbol) throw new Error(`Unknown symbol ${symbolName} in ${file.path}`);
  const content = source ?? await readFile(absolute, 'utf8');
  const lines = content.split(/\r?\n/);
  return lines.slice(symbol.startLine - 1, symbol.endLine).join('\n');
}
