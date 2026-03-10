# Admin Web

## Purpose

Admin Web is the browser-based operational surface for staff and platform operators.
It exists to keep admin workflows out of the student extension while still sharing the
same imported problem data and submission history stored in Postgres.

## Admin System Boundaries

| Area | Owner | Notes |
| --- | --- | --- |
| Admin UI | `apps/admin-web` | Browser-based React frontend for admin operators |
| Admin API | `apps/admin-api` | FastAPI backend for admin-only auth and operational routes |
| Shared storage | Postgres | Shared durable store with the student-facing stack |
| Student surface | `apps/vscode-extension` | Explicitly out of scope for admin operations |

## Core Capabilities

The current admin system is responsible for:

- admin authentication
- analytics overview
- problem list and problem detail editing
- public and hidden test management
- cross-user submission inspection
- platform user management

The admin system does not replace the student API or the student extension.

## Authentication Boundary

Admin access is separate from student auth.

- Primary admin login may use local email/password or Microsoft OIDC.
- Successful primary authentication is not sufficient on its own.
- Access still requires a local platform user with `role = admin` and `status = active`.
- TOTP is enforced after local user verification or identity mapping when enabled.

Session states:

- `unauthenticated`
- `pending_tfa`
- `authenticated_admin`

## Data Visibility Rules

Admin surfaces can inspect data that must never be exposed to the student path:

- hidden tests
- cross-user submission history
- admin-only analytics
- platform user-management operations

The student-facing API and extension remain restricted to student-visible content and
student-owned submission feedback.

## Relationship To The Judge Pipeline

Admin Web does not execute code. It reads operational data produced elsewhere:

- imported problem versions from the importer
- submission lifecycle state and terminal results from the judge path
- user and admin-session state from shared persistence

The judge worker remains the execution authority for both student and admin-observed outcomes.

## Local Development Notes

The standard local setup keeps Admin Web separate from the compose-managed student stack:

- run `admin-api` independently
- run Admin Web with the local `VITE_ADMIN_API_BASE_URL`
- use the mock OIDC mode when you need a provider-free local flow

See [local-development.md](./local-development.md) for commands and environment variables.
