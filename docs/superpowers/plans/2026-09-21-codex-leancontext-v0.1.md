# Codex LeanContext v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. TDD is required.

**Goal:** Build an installable local Codex plugin that selects minimal task-relevant repository context, can expand it safely, and measures savings.

**Architecture:** A local stdio MCP process scans/indexes a repository, builds symbol/dependency metadata, ranks context for a task, applies a safety guard, and exposes selective retrieval tools. A bundled Skill teaches Codex to start narrow and expand whenever correctness needs more information.

**Tech Stack:** Node.js 22+, TypeScript, Node test runner, JSON-RPC/MCP stdio, Git.

**Spec:** `docs/superpowers/specs/2026-09-21-codex-leancontext-v0.1-design.md`

## Global Constraints
- Local-only core; no API key.
- Never read outside repository root.
- Never index credential-like files.
- Quality > token savings.
- TypeScript/JavaScript/Python first; generic fallback.

## Review Focus
- Symlink escape must be blocked before file read.
- Generated/vendor trees and binary files must be excluded.
- Security/auth/schema tasks must force broader context.
- Weak retrieval matches must lower confidence.
- Corrupt cache must rebuild safely.

### Task 1: Runnable plugin and MCP vertical slice
Create manifests, Skill, protocol types, a stdio MCP dispatcher, and a test proving `leancontext_context_plan` is listed.

### Task 2: Secure repository scanner
Implement ignore rules, secret exclusions, binary/large-file filtering, `.gitignore`, and symlink containment with tests.

### Task 3: Symbol extraction and repository index
Implement TypeScript/JavaScript/Python/generic symbol/import extraction, hashing, test detection, and index creation with tests.

### Task 4: Incremental cache and dependency graph
Cache metadata only, reparse changed files only, and expose imports/importers/neighbors with tests.

### Task 5: Task-aware ranking and Safety Guard
Implement deterministic task ranking, context tiers, confidence, soft budgets, and elevated-risk expansion with tests.

### Task 6: Context retrieval and dynamic expansion
Implement metadata/symbol/full bundles plus imports/importers/tests/directory/symbol/file expansion while rechecking path policy.

### Task 7: Complete MCP API, Skill and CLI
Expose all six MCP tools and CLI commands; add stdio integration test.

### Task 8: Reproducible benchmark
Add baseline-vs-LeanContext reporting and a quality-preserving savings gate; verify package/build/test/typecheck/lint.
