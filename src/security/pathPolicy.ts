import path from 'node:path';
import { realpath } from 'node:fs/promises';

function assertContained(rootReal: string, candidateReal: string): void {
  const relative = path.relative(rootReal, candidateReal);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) return;
  throw new Error('Path is outside repository root');
}

export async function resolveInsideRoot(root: string, relativePath: string): Promise<string> {
  const rootReal = await realpath(root);
  const lexical = path.resolve(rootReal, relativePath);
  assertContained(rootReal, lexical);
  const candidateReal = await realpath(lexical);
  assertContained(rootReal, candidateReal);
  return candidateReal;
}
