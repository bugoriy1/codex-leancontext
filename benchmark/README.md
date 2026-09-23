# Benchmarks

`leancontext benchmark "<task>" [root]` performs a deterministic planning-only estimate. It compares approximate full-repository text tokens with LeanContext's selected context estimate.

This is **not** an actual Codex token benchmark and never satisfies the release gate. A release-grade benchmark must record two real Codex runs using the same model, repository commit, task, permissions, and verification command, then compare actual input-token usage with verification outcomes.

The release gate is:

1. LeanContext actual input tokens are lower than baseline actual input tokens.
2. Baseline verification succeeds.
3. LeanContext verification also succeeds.
4. Both runs are marked `measurement: "actual"`.
