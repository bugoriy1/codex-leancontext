import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTypeScript } from '../../src/parsers/typescriptParser.js';

test('extracts TypeScript symbols, imports, exports and line ranges', () => {
  const source = [
    "import { helper } from './helper.js';",
    'export interface Config { retries: number }',
    'export type Result = string;',
    'export function run(config: Config) {',
    '  return helper(config.retries);',
    '}',
    'const local = 1;',
  ].join('\n');
  const parsed = parseTypeScript(source);
  assert.deepEqual(parsed.imports, ['./helper.js']);
  assert.ok(parsed.exports.includes('Config'));
  assert.ok(parsed.exports.includes('Result'));
  assert.ok(parsed.exports.includes('run'));
  const run = parsed.symbols.find((symbol) => symbol.name === 'run');
  assert.equal(run?.kind, 'function');
  assert.equal(run?.startLine, 4);
});
