import { execFile } from 'node:child_process';
import { lstat, open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { isBuiltInIgnoredPath } from './ignoreRules.js';
import { resolveInsideRoot } from '../security/pathPolicy.js';
import { isSecretLikePath } from '../security/secretPatterns.js';

const execFileAsync = promisify(execFile);

export interface ScanOptions {
  root: string;
  maxFileBytes: number;
}

export interface ScannedFile {
  path: string;
  absolutePath: string;
  size: number;
  language: string;
}

function languageFor(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase();
  if (['.ts', '.tsx'].includes(ext)) return 'typescript';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (ext === '.py') return 'python';
  if (ext === '.json') return 'json';
  if (['.md', '.mdx'].includes(ext)) return 'markdown';
  return ext ? ext.slice(1) : 'text';
}

async function gitCandidates(root: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout.toString('utf8').split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

async function walkFallback(root: string, current = root): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute);
    if (isBuiltInIgnoredPath(relative)) continue;
    if (entry.isDirectory()) out.push(...await walkFallback(root, absolute));
    else out.push(relative);
  }
  return out;
}

async function isBinary(absolutePath: string): Promise<boolean> {
  const handle = await open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}

export async function scanRepository(options: ScanOptions): Promise<ScannedFile[]> {
  const root = await resolveInsideRoot(options.root, '.');
  const candidates = await gitCandidates(root) ?? await walkFallback(root);
  const files: ScannedFile[] = [];

  for (const candidate of candidates) {
    const relative = candidate.replaceAll('\\', '/');
    if (!relative || isBuiltInIgnoredPath(relative) || isSecretLikePath(relative)) continue;

    let absolutePath: string;
    try {
      absolutePath = await resolveInsideRoot(root, relative);
    } catch {
      continue;
    }

    const info = await lstat(path.join(root, relative)).catch(() => null);
    if (!info || info.isDirectory()) continue;
    const target = await stat(absolutePath).catch(() => null);
    if (!target?.isFile() || target.size > options.maxFileBytes) continue;
    if (await isBinary(absolutePath)) continue;

    files.push({ path: relative, absolutePath, size: target.size, language: languageFor(relative) });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}
