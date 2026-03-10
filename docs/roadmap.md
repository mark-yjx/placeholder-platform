# Roadmap

This roadmap summarizes the current project direction after the recent UI, architecture, and runtime-metrics hardening work.

## Current State

The repository already has a working local-first Online Judge with:

- VS Code extension client
- HTTP API server
- Postgres persistence
- judge worker
- Docker local runtime
- problem import pipeline
- stats, badges, and leaderboard MVP

The current emphasis is consolidation: make the platform understandable, observable, and reliable before broadening surface area.

## Near-Term Priorities

### Admin Web MVP

Admin Web MVP is now an explicit part of the project plan.

The current architecture separates student-facing and admin-facing surfaces:

- students use the VS Code extension with the Node/TypeScript API
- admins use Admin Web with the FastAPI `admin-api`
- both flows share Postgres and the existing judge worker

The finalized MVP scope for the admin stack is:

- admin login
- problems list
- problem detail/edit
- tests management
- submissions list/detail

This admin stack is meant to complement the existing student-facing platform, not replace it.

### Runtime Metrics Hardening Follow-Ups

Recent work established correct measured-vs-unavailable semantics. Follow-up work should focus on:

- broader verification across more verdict paths
- clearer `TLE` and resource-limit measurement behavior
- continued validation of cgroup-based memory collection in local and future deployment targets
- better operator diagnostics when runtime metrics are unavailable

### Extension UX Refinement

The extension workflow is now structurally in place. Near-term polish can focus on:

- clearer result messaging
- stronger recovery after reloads and restarts
- better affordances around starter files and selected problem context
- improved visibility into status transitions and failure reasons

### Stats & Ranking MVP

The first practical stats phase is now part of the shipped platform shape:

- per-student stats derived from submissions and problem metadata
- simple all-time, weekly, monthly, and streak leaderboards
- rule-based badges
- signed-in extension stats surface
- lightweight admin analytics overview

Future follow-up can focus on scale, richer profile presentation, and additional operator analytics without introducing contest-rating complexity too early.

## Security and Identity Direction

### Student Auth MVP

The next student-auth phase is focused on replacing embedded extension login with a browser-based student auth flow.

Planned direction:

- student `Sign in` and `Sign up` actions in the VS Code extension
- system-browser registration and login pages
- Node/TypeScript API remains the backend for student auth
- explicit student/admin auth separation
- automatic VS Code callback as the primary browser-to-extension completion path
- a short-lived auth code or session completion token exchanged by the extension for the real student session
- manual code handoff only as fallback if callback completion fails

This phase is intentionally scoped so that:

- admin auth remains in Admin Web and `admin-api`
- the extension remains student-only
- SSO for students is deferred until after browser-based local sign up/sign in works
- judge behavior remains unchanged

### Admin Identity Hardening

The next identity-security phase is focused on the admin stack, not the student stack.

Planned direction:

- local email/password login for Admin Web
- Microsoft OIDC login for Admin Web
- Microsoft as the first provider
- local resolution from either primary login mode to a platform user
- local enforcement of `role = admin` and `status = active`
- TOTP as a second factor after successful local user verification or identity mapping

This phase is intentionally scoped so that:

- the VS Code extension remains student-only
- the student-facing Node/TypeScript API is not redesigned
- judge behavior remains unchanged

### TOTP / Authenticator

TOTP remains part of the planned admin hardening direction, but it is tied to the admin-only local-login-or-OIDC-plus-local-authorization flow rather than becoming a platform-wide auth rewrite in the same phase.

## Future Deployment Direction

The current system is intentionally local-first and compose-centric. Longer term, likely deployment directions include:

- promoting the API and worker into separately managed runtime services
- formalizing production-grade secret handling
- improving observability and runbooks for queue and sandbox behavior
- making deployment topology explicit beyond the current local compose environment
- evaluating safer or more portable sandboxing strategies where needed

The local compose stack should remain the canonical developer integration environment even as deployment targets grow.

## Longer-Term Product Direction

Possible future themes:

- richer public stats and ranking views
- better admin workflows for tests management, content publishing, and rejudge operations
- admin user management
- admin 2FA / authenticator flows
- richer admin dashboard and analytics surfaces
- more problem-author tooling around validation and previews
- release automation and packaging improvements
- deployment hardening beyond the current local-first baseline
- stronger documentation and contributor onboarding

## Reading Order For Contributors

If you are new to the repository, start here:

1. `README.md`
2. `docs/architecture.md`
3. `docs/local-development.md`
4. `docs/problem-format.md`
5. `docs/judge-pipeline.md`
6. `docs/runtime-metrics.md`
7. `.specify/specs/tasks.md`
