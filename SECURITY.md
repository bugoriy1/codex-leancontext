# Security

LeanContext is designed to run locally and its core makes no network requests. The index cache stores metadata and hashes, not source text.

The scanner excludes common credential files (`.env*`, `*.pem`, `*.key`, `credentials.*`, `secrets.*`), rejects binary and generated/vendor files, and resolves real paths before reading to block symlink/path traversal outside the repository root.

If you find a vulnerability, do not publish secrets or exploit details in a public issue. Use GitHub private vulnerability reporting when the repository enables it.
