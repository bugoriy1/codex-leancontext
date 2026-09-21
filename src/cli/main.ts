#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runPlanningBenchmark } from '../benchmark/runner.js';
import { buildContextPlan } from '../context/buildContextPlan.js';
import { getChangedPaths } from '../git/changedContext.js';
import { indexProject, planProject, tokenReport } from '../service/projectService.js';

export interface CliIo {
  out(value: string): void;
  err(value: string): void;
}

export interface CliOptions {
  dataRoot?: string;
}

const defaultIo: CliIo = {
  out(value) { process.stdout.write(value); },
  err(value) { process.stderr.write(value); },
};

function json(io: CliIo, value: unknown): void {
  io.out(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runCli(argv: string[], io: CliIo = defaultIo, options: CliOptions = {}): Promise<number> {
  const [command, first, second] = argv;
  try {
    if (command === 'index' || command === 'status') {
      const root = first ?? process.cwd();
      const built = await indexProject(root, options);
      json(io, { root: built.index.root, fileCount: built.index.files.length, stats: built.stats });
      return 0;
    }
    if (command === 'context') {
      if (!first) throw new Error('Usage: leancontext context "task" [root]');
      const root = second ?? process.cwd();
      const planned = await planProject(root, first, options);
      json(io, planned.plan);
      return 0;
    }
    if (command === 'benchmark') {
      if (!first) throw new Error('Usage: leancontext benchmark \"task\" [root]');
      const root = second ?? process.cwd();
      json(io, await runPlanningBenchmark(root, first, options));
      return 0;
    }
    if (command === 'changed') {
      const root = first ?? process.cwd();
      json(io, { paths: await getChangedPaths(root) });
      return 0;
    }
    if (command === 'report') {
      if (!first) throw new Error('Usage: leancontext report "task" [root]');
      const root = second ?? process.cwd();
      const built = await indexProject(root, options);
      const plan = buildContextPlan(built.index, first, { changedPaths: await getChangedPaths(root) });
      json(io, tokenReport(built.index, plan));
      return 0;
    }
    io.err('Usage: leancontext <index|status|context|benchmark|changed|report> [args]\n');
    return 1;
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectExecution()) process.exitCode = await runCli(process.argv.slice(2));
