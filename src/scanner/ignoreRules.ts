const ignoredSegments = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.venv',
  'venv',
  '__pycache__',
]);

export function isBuiltInIgnoredPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.some((segment) => ignoredSegments.has(segment))) return true;
  return normalized.endsWith('.min.js') || normalized.endsWith('.map');
}
