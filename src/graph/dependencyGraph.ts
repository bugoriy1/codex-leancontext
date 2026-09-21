import type { RepositoryIndex } from '../shared/types.js';
import { resolveLocalImport } from './moduleResolver.js';

export interface DependencyGraph {
  importsOf(path: string): string[];
  importersOf(path: string): string[];
  neighbors(path: string, depth: number): string[];
}

export function createDependencyGraph(index: RepositoryIndex): DependencyGraph {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const file of index.files) {
    const resolved = new Set<string>();
    for (const specifier of file.imports) {
      const target = resolveLocalImport(index, file.path, specifier);
      if (target) resolved.add(target);
    }
    forward.set(file.path, resolved);
    for (const target of resolved) {
      const importers = reverse.get(target) ?? new Set<string>();
      importers.add(file.path);
      reverse.set(target, importers);
    }
  }

  const sorted = (values: Iterable<string>) => [...values].sort();
  return {
    importsOf(filePath) { return sorted(forward.get(filePath) ?? []); },
    importersOf(filePath) { return sorted(reverse.get(filePath) ?? []); },
    neighbors(filePath, depth) {
      const seen = new Set<string>([filePath]);
      const result: string[] = [];
      let frontier = [filePath];
      for (let level = 0; level < depth; level += 1) {
        const next: string[] = [];
        for (const current of frontier) {
          for (const candidate of forward.get(current) ?? []) {
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            result.push(candidate);
            next.push(candidate);
          }
        }
        frontier = next;
        if (frontier.length === 0) break;
      }
      return result;
    },
  };
}
