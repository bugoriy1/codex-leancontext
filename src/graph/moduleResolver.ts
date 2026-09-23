import path from 'node:path';
import type { RepositoryIndex } from '../shared/types.js';

const tsJsExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function normalized(value: string): string {
  return value.replaceAll('\\', '/');
}

export function resolveLocalImport(index: RepositoryIndex, fromPath: string, specifier: string): string | null {
  const paths = new Set(index.files.map((file) => normalized(file.path)));
  if (specifier.startsWith('.')) {
    const base = normalized(path.posix.normalize(path.posix.join(path.posix.dirname(normalized(fromPath)), specifier)));
    const candidates = [base];
    const ext = path.posix.extname(base);
    if (ext) {
      for (const replacement of tsJsExtensions) candidates.push(`${base.slice(0, -ext.length)}${replacement}`);
    } else {
      for (const extension of tsJsExtensions) candidates.push(`${base}${extension}`);
      for (const extension of tsJsExtensions) candidates.push(`${base}/index${extension}`);
    }
    return candidates.find((candidate) => paths.has(candidate)) ?? null;
  }

  if (!specifier.includes('/') && !specifier.includes('.')) return null;
  const pythonCandidate = `${specifier.replaceAll('.', '/')}.py`;
  return paths.has(pythonCandidate) ? pythonCandidate : null;
}
