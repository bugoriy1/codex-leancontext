import { readFile } from 'node:fs/promises';
import { realpath } from 'node:fs/promises';
import { scanRepository } from '../scanner/scanRepository.js';
import { parseSource } from '../parsers/parser.js';
import { hashContent } from './hashFile.js';
import type { IndexedFile, RepositoryIndex } from '../shared/types.js';

export interface BuildIndexOptions {
  root: string;
  maxFileBytes?: number;
}

function isTestPath(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/').toLowerCase();
  return normalized.includes('/tests/') || normalized.startsWith('tests/') || /\.(test|spec)\.[^.]+$/.test(normalized);
}

export async function buildIndex(options: BuildIndexOptions): Promise<RepositoryIndex> {
  const root = await realpath(options.root);
  const scanned = await scanRepository({ root, maxFileBytes: options.maxFileBytes ?? 2 * 1024 * 1024 });
  const files: IndexedFile[] = [];

  for (const file of scanned) {
    const content = await readFile(file.absolutePath, 'utf8');
    const parsed = parseSource(file.language, content);
    files.push({
      path: file.path,
      language: file.language,
      bytes: file.size,
      hash: hashContent(content),
      symbols: parsed.symbols,
      imports: parsed.imports,
      exports: parsed.exports,
      isTest: isTestPath(file.path),
    });
  }

  return { root, generatedAt: new Date().toISOString(), files };
}
