import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createDependencyGraph } from '../graph/dependencyGraph.js';
import { hashContent } from '../index/hashFile.js';
import { resolveInsideRoot } from '../security/pathPolicy.js';
import { isSecretLikePath } from '../security/secretPatterns.js';
import { getFileChunk } from './getContext.js';
import type { ContextBundle, ContextChunk, ExpansionRequest, IndexedFile, RepositoryIndex } from '../shared/types.js';

function tokenEstimate(chunks: ContextChunk[]): number {
  return Math.ceil(chunks.reduce((sum, chunk) => sum + (chunk.content?.length ?? JSON.stringify(chunk).length), 0) / 4);
}

function matchingTests(index: RepositoryIndex, target: string): IndexedFile[] {
  const base = path.posix.basename(target).replace(/\.[^.]+$/, '');
  return index.files.filter((file) => file.isTest && (file.path.includes(base) || file.imports.some((specifier) => specifier.includes(base))));
}

async function explicitFile(index: RepositoryIndex, requestedPath: string): Promise<ContextChunk> {
  if (isSecretLikePath(requestedPath)) throw new Error('Refusing to read secret-like path');
  await resolveInsideRoot(index.root, requestedPath);
  const file = index.files.find((candidate) => candidate.path === requestedPath.replaceAll('\\', '/'));
  if (!file) throw new Error(`File is not indexed: ${requestedPath}`);
  return getFileChunk(index, file, 'full');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function freshContent(index: RepositoryIndex, file: IndexedFile): Promise<string> {
  const absolute = await resolveInsideRoot(index.root, file.path);
  const content = await readFile(absolute, 'utf8');
  if (hashContent(content) !== file.hash) throw new Error(`Index is stale for ${file.path}; re-run indexing`);
  return content;
}

async function callerChunks(index: RepositoryIndex, symbol: string): Promise<ContextChunk[]> {
  const chunks: ContextChunk[] = [];
  const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\s*\\(`);
  for (const file of index.files) {
    if (isSecretLikePath(file.path)) continue;
    const content = await freshContent(index, file);
    const lines = content.split(/\r?\n/);
    const declarationLines = new Set(file.symbols.filter((candidate) => candidate.name === symbol).map((candidate) => candidate.startLine));
    const hits = lines
      .map((line, i) => pattern.test(line) && !declarationLines.has(i + 1) ? i : -1)
      .filter((i) => i >= 0);
    if (hits.length === 0) continue;
    const snippets = hits.slice(0, 5).map((i) => lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n'));
    chunks.push({ path: file.path, tier: 'symbol', symbols: [symbol], imports: file.imports, exports: file.exports, content: snippets.join('\n---\n') });
  }
  return chunks;
}

const nonCallKeywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new']);

async function calleeChunks(index: RepositoryIndex, file: IndexedFile): Promise<ContextChunk[]> {
  const content = await freshContent(index, file);
  const lines = content.split(/\r?\n/);
  const names = new Set<string>();
  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    for (const match of line.matchAll(callPattern)) {
      const name = match[1];
      if (!name || nonCallKeywords.has(name)) continue;
      const isDeclaration = file.symbols.some((symbol) => symbol.name === name && symbol.startLine === i + 1);
      if (!isDeclaration) names.add(name);
    }
  }

  const matchedFiles = index.files.filter((candidate) => candidate.symbols.some((symbol) => names.has(symbol.name)));
  return Promise.all(matchedFiles.map((candidate) => getFileChunk(index, candidate, 'metadata')));
}

export async function expandContext(index: RepositoryIndex, request: ExpansionRequest): Promise<ContextBundle> {
  const graph = createDependencyGraph(index);
  const byPath = new Map(index.files.map((file) => [file.path, file]));
  let chunks: ContextChunk[] = [];

  if (request.relation === 'file') {
    if (!request.path) throw new Error('path is required');
    chunks = [await explicitFile(index, request.path)];
  } else if (request.relation === 'symbol') {
    if (!request.symbol) throw new Error('symbol is required');
    const matches = index.files.filter((file) => file.symbols.some((symbol) => symbol.name === request.symbol));
    chunks = await Promise.all(matches.map((file) => getFileChunk(index, file, 'symbol', [request.symbol as string])));
  } else if (request.relation === 'callers') {
    if (!request.symbol) throw new Error('symbol is required');
    chunks = await callerChunks(index, request.symbol);
  } else if (request.relation === 'callees') {
    if (!request.path) throw new Error('path is required');
    const file = byPath.get(request.path);
    if (!file) throw new Error(`File is not indexed: ${request.path}`);
    chunks = await calleeChunks(index, file);
  } else if (request.relation === 'imports' || request.relation === 'importers') {
    if (!request.path) throw new Error('path is required');
    const paths = request.relation === 'imports' ? graph.importsOf(request.path) : graph.importersOf(request.path);
    chunks = await Promise.all(paths.map((filePath) => byPath.get(filePath)).filter((value): value is IndexedFile => Boolean(value)).map((file) => getFileChunk(index, file, 'metadata')));
  } else if (request.relation === 'tests') {
    if (!request.path) throw new Error('path is required');
    chunks = await Promise.all(matchingTests(index, request.path).map((file) => getFileChunk(index, file, 'metadata')));
  } else if (request.relation === 'directory') {
    if (!request.path) throw new Error('path is required');
    const directory = path.posix.dirname(request.path.replaceAll('\\', '/'));
    const matches = index.files.filter((file) => path.posix.dirname(file.path) === directory);
    chunks = await Promise.all(matches.map((file) => getFileChunk(index, file, 'metadata')));
  }

  return { chunks, estimatedTokens: tokenEstimate(chunks) };
}
