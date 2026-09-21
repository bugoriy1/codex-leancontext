# Contributing

Requirements: Node.js 22+, Git, TypeScript 5.8+.

Development follows test-driven development: add a failing behavior test, verify the expected failure, implement the smallest change, then run the full suite.

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Changes that reduce context must not weaken repository verification or bypass the context safety guard.
