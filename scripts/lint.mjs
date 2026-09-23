import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

let failed = false;
for (const file of await walk('src').catch(() => [])) {
  const text = await readFile(file, 'utf8');
  if (text.includes('\t')) { console.error(`${file}: tabs are not allowed`); failed = true; }
  if (/console\.log\(/.test(text)) { console.error(`${file}: console.log is not allowed in runtime code`); failed = true; }
}
if (failed) process.exit(1);
console.error('lint: ok');
