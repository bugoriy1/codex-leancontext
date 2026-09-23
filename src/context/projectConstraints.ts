import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ProjectConstraints {
  node?: string;
  module?: 'esm';
  runtimeDependencies?: string;
}

export async function projectConstraints(root: string): Promise<ProjectConstraints> {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { engines?: { node?: unknown }; type?: unknown; dependencies?: unknown };
    const constraints: ProjectConstraints = {};
    if (typeof manifest.engines?.node === 'string') constraints.node = manifest.engines.node;
    if (manifest.type === 'module') constraints.module = 'esm';
    if (manifest.dependencies && typeof manifest.dependencies === 'object' && Object.keys(manifest.dependencies).length === 0) constraints.runtimeDependencies = 'none; do not add unless task requires';
    if (!manifest.dependencies) constraints.runtimeDependencies = 'none; do not add unless task requires';
    return constraints;
  } catch { return {}; }
}
