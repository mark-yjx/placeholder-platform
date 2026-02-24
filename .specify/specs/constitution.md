# COMP9021 OJ Constitution

## Core Principles

### I. Domain-First Architecture (Immutable)
All core entities (`Problem`, `Submission`, `User`, `Announcement`, `Review`, `Favorite`, `PlagiarismReport`) MUST remain framework-independent domain models.

### II. Clean Boundaries (Immutable)
Modules MUST be separated by bounded context and responsibilities: `auth`, `problem`, `submission`, `plagiarism`, `stats`, `announcement`, `judge-worker`.

### III. Security by Default (Immutable)
Security controls are mandatory in all relevant flows: password hashing, rate limiting, JWT/session safety, mandatory TOTP 2FA, and RBAC roles (`student`, `admin`).

### IV. Judge Isolation (Immutable)
User-submitted code MUST execute only inside a restricted Docker sandbox with enforced CPU/memory/time limits and no network access.

### V. Testability (Immutable)
Core domain logic MUST have unit test coverage. The judge pipeline MUST have integration tests.

### VI. Observability (Immutable)
All services MUST emit structured logs and propagate request IDs. Submission lifecycle MUST follow a defined state machine: `queued` -> `running` -> `finished` or `failed`.

### VII. API-Contract First (Immutable)
OpenAPI contracts MUST be defined and reviewed before implementation begins.

### VIII. Extensibility (Immutable)
Adding new languages or future features MUST NOT require rewrites of existing modules; extension points and modular design are required.

## Scope
This constitution applies to all architecture, implementation, and review decisions across the project.

## Governance
This constitution is immutable unless explicitly amended by project governance.
All plans, specs, and implementation changes MUST demonstrate compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-02-24 | **Last Amended**: 2026-02-24
