# Codex LeanContext

**Give Codex less irrelevant code, not less necessary code.**

Codex LeanContext is an early open-source local context optimizer for coding agents. It scans a repository, builds metadata/symbol/dependency maps, ranks files for the current task, and lets the agent expand context only when needed.

> Status: **v0.1 development alpha.** The core is implemented and locally tested. No real-world token-savings percentage is claimed yet; live Codex A/B benchmarking is still required before a performance claim or release-grade benchmark can pass.

## Why

Coding agents can spend substantial context repeatedly exploring large repositories. LeanContext tries to reduce that waste while preserving a hard rule: **correctness beats token savings**.

When relevance is weak or the task touches authentication, permissions, cryptography, migrations, public APIs, concurrency, or dependency upgrades, the Safety Guard broadens context instead of forcing a small budget.

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
- Local stdio MCP server with six tools.
- CLI and a bundled Codex Skill.
- Planning-only benchmark that is explicitly labeled `estimated`.

## MCP tools

- `leancontext_index`
- `leancontext_context_plan`
- `leancontext_get_context`
- `leancontext_expand`
- `leancontext_changed_context`
- `leancontext_token_report`

`leancontext_context_plan` returns a short `planId`. The server keeps the detailed plan in memory so subsequent calls do not need to echo the whole plan back through model context.

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
- No actual Codex A/B token benchmark has been run in this build environment.
- The source tree currently has no generated npm lockfile because the build environment could not reach the npm registry; generate and commit one before a stable public release.
