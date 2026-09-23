import path from 'node:path';
import { resolveLocalImport } from '../graph/moduleResolver.js';
import type { IndexedFile, RepositoryIndex } from '../shared/types.js';

function stem(value: string): string { return path.posix.basename(value.replaceAll('\\', '/')).replace(/\.[^.]+$/, '').replace(/\.(test|spec)$/, '').toLowerCase(); }

export function relatedTests(index: RepositoryIndex, targetPath: string): IndexedFile[] {
  const target = index.files.find((file) => file.path === targetPath);
  if (!target) return [];
  return index.files.filter((test) => {
    if (!test.isTest) return false;
    const resolved = test.imports.map((specifier) => resolveLocalImport(index, test.path, specifier)).filter((value): value is string => value !== null);
    if (resolved.length > 0) return resolved.includes(target.path);
    return stem(test.path) === stem(target.path) && path.posix.dirname(test.path).replace(/^tests\//, 'src/') === path.posix.dirname(target.path);
  }).sort((left, right) => left.path.localeCompare(right.path));
}
