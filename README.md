# Codex LeanContext

**Give Codex less irrelevant code, not less necessary code.**

Codex LeanContext is an early open-source local context optimizer for coding agents. It scans a repository, builds metadata/symbol/dependency maps, ranks files for the current task, and lets the agent expand context only when needed.

> Status: **v0.1 development alpha.** The core is implemented and locally tested.

## Why

Coding agents can spend substantial context repeatedly exploring large repositories. LeanContext tries to reduce that waste while preserving a hard rule: **correctness beats token savings**.

When relevance is weak or the task touches authentication, permissions, cryptography, migrations, public APIs, concurrency, or dependency upgrades, the Safety Guard broadens context instead of forcing a small budget.

## Benchmark status

Matched local Codex A/B runs have been performed with successful verification. Measured actual input-token reductions were 37.9% on the dogfood task, 13.7% on repaired Holdout #1 regression validation, and 11.4% on fresh Holdout #2. These are task-specific measurements, not a universal token-savings guarantee. Correctness and successful verification remain more important than token savings.

## What v0.1 includes

- Secure repository scanner with `.gitignore` support through Git.
- Secret, binary, generated/vendor and symlink-escape exclusions.
- TypeScript/JavaScript/Python symbol and import indexing with generic fallback.
- Incremental metadata-only cache keyed by file hashes.
- Local dependency graph.
- Task-aware deterministic ranking; no extra LLM/API call.
- `metadata`, `symbol`, and `full` context tiers.
- Dynamic expansion: `imports`, `importers`, `tests`, `directory`, `symbol`, `file`, plus heuristic `callers`/`callees` discovery.
- Git working-tree delta awareness.
- Token/context telemetry.
- Local stdio MCP server with a two-tool default surface.
- CLI and a bundled Codex Skill.
- Planning-only benchmark that is explicitly labeled `estimated`.

## MCP tools

- `leancontext_context`
- `leancontext_expand`

Call `leancontext_context` first. It indexes/caches, plans, and returns compact initial source context in one call. Use `leancontext_expand` only when more context is required for correctness. Set `LEANCONTEXT_LEGACY_TOOLS=1` only for compatibility with the legacy index/plan/get/report tools.

## Build from source

```bash
git clone <repository-url>
cd codex-leancontext
npm install
npm run build
npm test
```

The repository includes portable `plugin.json` + `mcp.json` manifests and a Codex compatibility overlay. The v0.1 server intentionally implements the legacy stdio MCP handshake without an SDK runtime dependency; modern SDK migration is planned before a stable release. Until repository/plugin-marketplace installation is validated end-to-end, the directly verified local path is to run the built stdio server:

```bash
node dist/src/mcp/server.js
```

For Codex CLI, an absolute local path can be registered with the normal `codex mcp add` workflow after building.

## CLI

```bash
leancontext index [root]
leancontext status [root]
leancontext context "task description" [root]
leancontext benchmark "task description" [root]
leancontext changed [root]
leancontext report "task description" [root]
```

## Privacy

The core has no network code and needs no OpenAI API key. Cached data contains file metadata, hashes, symbols, imports/exports and graph edges—not source text.

## Benchmark policy

Planning estimates are useful for development but are not proof of real token savings. A release-grade result must use the same Codex model, commit, task, permissions and verification command for baseline and LeanContext runs, use actual usage data, and have successful verification in both runs.

See `benchmark/README.md`.

## License

MIT

## v0.1 limitations

- TypeScript/JavaScript/Python symbol extraction is intentionally lightweight and heuristic in this alpha; complex syntax can require full-file expansion.
- `callers`/`callees` are local name-based heuristics, not a whole-program semantic call graph.
- The source tree currently has no generated npm lockfile because the build environment could not reach the npm registry; generate and commit one before a stable public release.
