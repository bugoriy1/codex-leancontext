import path from 'node:path';

const exactSecretNames = new Set([
  '.env',
  'credentials',
  'credentials.json',
  'secrets',
  'secrets.json',
]);

export function isSecretLikePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/');
  const base = path.posix.basename(normalized).toLowerCase();
  if (exactSecretNames.has(base)) return true;
  if (base.startsWith('.env.')) return true;
  if (base.endsWith('.pem') || base.endsWith('.key') || base.endsWith('.p12') || base.endsWith('.pfx')) return true;
  if (/^(credentials|secrets)\./i.test(base)) return true;
  return false;
}
