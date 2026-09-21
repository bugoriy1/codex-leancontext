import { readFile } from 'node:fs/promises';
import { hashContent } from '../index/hashFile.js';
import { resolveInsideRoot } from '../security/pathPolicy.js';
import { isSecretLikePath } from '../security/secretPatterns.js';
import { readSymbol } from './readSymbol.js';
import type { ContextBundle, ContextChunk, ContextPlan, IndexedFile, RepositoryIndex } from '../shared/types.js';

async function readFreshSource(index: RepositoryIndex, file: IndexedFile): Promise<string> {
  const absolute = await resolveInsideRoot(index.root, file.path);
  const content = await readFile(absolute, 'utf8');
  if (hashContent(content) !== file.hash) throw new Error(`Index is stale for ${file.path}; re-run context planning`);
  return content;
}

async function chunkFor(index: RepositoryIndex, file: IndexedFile, tier: ContextChunk['tier'], symbols: string[] = []): Promise<ContextChunk> {
  const base = { path: file.path, tier, symbols: file.symbols.map((symbol) => symbol.name), imports: file.imports, exports: file.exports };
  if (tier === 'metadata') return base;
  if (isSecretLikePath(file.path)) throw new Error('Refusing to read secret-like path');
  if (tier === 'full') return { ...base, content: await readFreshSource(index, file) };
  const source = await readFreshSource(index, file);
  const selected = symbols.length > 0 ? symbols : file.symbols.slice(0, 3).map((symbol) => symbol.name);
  const slices: string[] = [];
  for (const symbol of selected) slices.push(await readSymbol(index.root, file, symbol, source));
  return { ...base, symbols: selected, content: slices.join('\n\n') };
}

export async function getContext(index: RepositoryIndex, plan: ContextPlan): Promise<ContextBundle> {
  const byPath = new Map(index.files.map((file) => [file.path, file]));
  const chunks: ContextChunk[] = [];
  let characters = 0;
  for (const item of plan.items) {
    const file = byPath.get(item.path);
    if (!file) continue;
    const chunk = await chunkFor(index, file, item.tier, item.symbols ?? []);
    chunks.push(chunk);
    characters += chunk.content?.length ?? JSON.stringify(chunk).length;
  }
  return { chunks, estimatedTokens: Math.ceil(characters / 4) };
}

export async function getFileChunk(index: RepositoryIndex, file: IndexedFile, tier: ContextChunk['tier'], symbols: string[] = []): Promise<ContextChunk> {
  return chunkFor(index, file, tier, symbols);
}
