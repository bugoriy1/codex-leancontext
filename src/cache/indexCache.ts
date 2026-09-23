import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RepositoryIndex } from '../shared/types.js';
import { cacheFilePath } from './cachePaths.js';

interface CacheEnvelope {
  version: 1;
  index: RepositoryIndex;
}

export async function loadIndexCache(root: string, dataRoot?: string): Promise<RepositoryIndex | null> {
  const file = await cacheFilePath(root, dataRoot);
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<CacheEnvelope>;
    if (parsed.version !== 1 || !parsed.index || !Array.isArray(parsed.index.files)) return null;
    return parsed.index;
  } catch {
    return null;
  }
}

export async function saveIndexCache(index: RepositoryIndex, dataRoot?: string): Promise<void> {
  const file = await cacheFilePath(index.root, dataRoot);
  await mkdir(path.dirname(file), { recursive: true });
  const payload: CacheEnvelope = { version: 1, index };
  await writeFile(file, `${JSON.stringify(payload)}\n`, 'utf8');
}
