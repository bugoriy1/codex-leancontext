import { readFile, realpath } from 'node:fs/promises';
import { scanRepository } from '../scanner/scanRepository.js';
import { parseSource } from '../parsers/parser.js';
import { hashContent } from './hashFile.js';
import { loadIndexCache, saveIndexCache } from '../cache/indexCache.js';
import type { IndexedFile, RepositoryIndex } from '../shared/types.js';

export interface IncrementalBuildOptions {
  root: string;
  dataRoot?: string;
  maxFileBytes?: number;
}

export interface IndexBuildStats {
  scanned: number;
  parsed: number;
  cacheHits: number;
}

function isTestPath(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/').toLowerCase();
  return normalized.includes('/tests/') || normalized.startsWith('tests/') || /\.(test|spec)\.[^.]+$/.test(normalized);
}

export async function buildIncrementalIndex(options: IncrementalBuildOptions): Promise<{ index: RepositoryIndex; stats: IndexBuildStats }> {
  const root = await realpath(options.root);
  const scanned = await scanRepository({ root, maxFileBytes: options.maxFileBytes ?? 2 * 1024 * 1024 });
  const previous = await loadIndexCache(root, options.dataRoot);
  const cached = new Map((previous?.files ?? []).map((file) => [file.path, file]));
  const files: IndexedFile[] = [];
  let parsed = 0;
  let cacheHits = 0;

  for (const file of scanned) {
    const content = await readFile(file.absolutePath, 'utf8');
    const hash = hashContent(content);
    const prior = cached.get(file.path);
    if (prior && prior.hash === hash && prior.language === file.language && prior.bytes === file.size) {
      files.push(prior);
      cacheHits += 1;
      continue;
    }
    const parsedSource = parseSource(file.language, content);
    files.push({
      path: file.path,
      language: file.language,
      bytes: file.size,
      hash,
      symbols: parsedSource.symbols,
      imports: parsedSource.imports,
      exports: parsedSource.exports,
      isTest: isTestPath(file.path),
    });
    parsed += 1;
  }

  const index: RepositoryIndex = { root, generatedAt: new Date().toISOString(), files };
  await saveIndexCache(index, options.dataRoot);
  return { index, stats: { scanned: scanned.length, parsed, cacheHits } };
}
