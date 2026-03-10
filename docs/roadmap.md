# Roadmap

## Current Baseline

The repository already has the core Online Judge shape in place:

- student workflow in the VS Code extension
- student-facing submission API
- Postgres-backed persistence
- Docker-backed judge execution
- separate Admin Web and `admin-api`
- manifest-driven problem import
- measured-vs-unavailable runtime metrics semantics

## Near-Term Priorities

### Student Authentication Boundary

- keep student auth on the student-facing API
- keep the extension as the student-only client
- complete the browser-based student auth flow and callback handling without merging it into the admin stack

### Admin System Hardening

- keep admin auth in Admin Web plus `admin-api`
- continue local admin authorization and TOTP enforcement
- improve admin operational workflows without exposing admin-only data to the student surface

### Judge And Runtime Metrics Reliability

- preserve trustworthy runtime metrics
- improve operator diagnostics when measurements are unavailable
- keep verdict production and failure handling explicit

### Documentation And Local Operability

- keep architecture, auth boundaries, and local workflow docs aligned
- keep the core docs set small enough to act as the source of truth
- remove duplicate runbooks and outdated checklists as they are replaced

## Longer-Term Direction

- richer admin analytics and operator tooling
- more complete student auth UX
- broader stats and ranking surfaces
- deployment and release hardening after local workflows remain stable

## Stable Product Boundaries

The roadmap does not change these boundaries:

- the extension remains student-only
- Admin Web remains the admin UI
- hidden tests remain server-side
- the judge worker remains the only code-execution surface
- Postgres remains the durable source of truth
