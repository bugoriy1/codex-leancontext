import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function gitNames(root: string, args: string[]): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
    return stdout.toString('utf8').split('\0').filter(Boolean).map((value) => value.replaceAll('\\', '/'));
  } catch {
    return [];
  }
}

export async function getChangedPaths(root: string, base?: string): Promise<string[]> {
  if (base) return [...new Set(await gitNames(root, ['diff', '--name-only', '-z', base, '--']))].sort();
  const [working, staged, untracked] = await Promise.all([
    gitNames(root, ['diff', '--name-only', '-z', '--']),
    gitNames(root, ['diff', '--cached', '--name-only', '-z', '--']),
    gitNames(root, ['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  return [...new Set([...working, ...staged, ...untracked])].sort();
}
