---
name: lean-context
description: Reduce broad repository exploration by starting from a task-aware LeanContext plan and expanding whenever correctness requires more code.
---

Before broad repository exploration, call `leancontext_context` for the user's task and use its returned source directly. Use `leancontext_expand` only when correctness requires more context. Never preserve token savings at the expense of correctness. After edits, run the repository's normal verification commands.
