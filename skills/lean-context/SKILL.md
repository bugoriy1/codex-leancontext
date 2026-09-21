---
name: lean-context
description: Reduce broad repository exploration by starting from a task-aware LeanContext plan and expanding whenever correctness requires more code.
---

Before broad repository exploration, call `leancontext_context_plan` for the user's task. Treat the returned context as a starting point, never a hard boundary. Use `leancontext_expand` or inspect source directly whenever implementation correctness requires more information. Never preserve token savings at the expense of correctness. After edits, run the repository's normal verification commands.
