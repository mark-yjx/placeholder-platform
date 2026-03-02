# @packages/config

Shared workspace config artifacts.

- `dependency-boundaries.json`: dependency direction rules for workspace imports.
- `env.required.json`: required environment variables by runtime target (`api`, `worker`).
- `env.required.json` is the source of truth for runtime-required environment variables.
- See `docs/environment-and-local-setup.md` for local defaults, port usage, conflict guidance, and reset commands.
