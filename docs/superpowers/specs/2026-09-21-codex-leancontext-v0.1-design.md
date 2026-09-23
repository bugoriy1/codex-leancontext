# Codex LeanContext v0.1 Design

Codex LeanContext is a local, open-source Codex plugin that reduces irrelevant repository context while preserving correctness. It uses a task-aware repository index, selective context tiers, dynamic expansion, a safety guard, and token telemetry. Quality is always more important than token savings.

## Constraints
- Local-only core; no hosted service or API key.
- No reading outside repository root.
- Secrets and credential-like files are never indexed.
- Token budgets are soft; safety can expand context.
- Initial languages: TypeScript, JavaScript, Python; generic fallback for others.
- Plugin shape: portable `plugin.json` + `mcp.json` + Skill + local stdio MCP.
- Public repo target: `codex-leancontext`, MIT license.

## Core tools
`leancontext_index`, `leancontext_context_plan`, `leancontext_get_context`, `leancontext_expand`, `leancontext_changed_context`, `leancontext_token_report`.

## Success gate
Token/context usage must fall while verification success is no worse than baseline.
