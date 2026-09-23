import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePython } from '../../src/parsers/pythonParser.js';

test('extracts Python imports, functions and classes', () => {
  const source = [
    'import os',
    'from app.util import helper',
    '',
    'class Worker:',
    '    pass',
    '',
    'def run(value):',
    '    return helper(value)',
  ].join('\n');
  const parsed = parsePython(source);
  assert.deepEqual(parsed.imports, ['os', 'app.util']);
  assert.equal(parsed.symbols.find((s) => s.name === 'Worker')?.kind, 'class');
  assert.equal(parsed.symbols.find((s) => s.name === 'run')?.startLine, 7);
});
