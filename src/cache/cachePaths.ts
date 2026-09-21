import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

export function defaultDataRoot(): string {
  if (process.env.PLUGIN_DATA) return process.env.PLUGIN_DATA;
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'codex-leancontext');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'codex-leancontext');
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'), 'codex-leancontext');
}

export async function cacheFilePath(root: string, dataRoot = defaultDataRoot()): Promise<string> {
  const canonical = await realpath(root);
  const id = createHash('sha256').update(canonical).digest('hex').slice(0, 24);
  return path.join(dataRoot, 'repositories', id, 'index.json');
}
