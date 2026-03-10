# Admin Web MVP

## Overview

Admin Web is the browser-based administration surface for the Online Judge.

It exists so staff and operators can manage platform content and inspect admin-only data without overloading the student workflow inside the VS Code extension.

Primary audience:

- teaching staff
- problem authors
- platform operators

Admin Web is intentionally separate from the extension because the extension is optimized for student practice, submission, and result review, while admin work needs different pages, different data visibility, and different access controls.

## Why A Separate Admin Frontend Exists

The student workflow and the admin workflow have different constraints:

- students use the VS Code extension to log in, browse published problems, work on starter files, submit code, and inspect their own results
- admins need browser-based operational pages for content editing, admin-only test data, and cross-user submission inspection

Keeping those flows separate reduces accidental coupling:

- student-facing UX stays focused on practice and submission
- admin-only data does not have to be exposed through student-facing routes
- hidden tests remain admin-only

## Architecture

### Student Side

- frontend: VS Code extension in `apps/vscode-extension`
- API layer: existing Node/TypeScript API in `apps/api`

Student-facing routes and payloads remain focused on published content and student-owned activity. They must not expose hidden tests or other admin-only operational data.

### Admin Side

- frontend: Admin Web in `apps/admin-web`
- API layer: FastAPI `admin-api` in `apps/admin-api`

Admin Web authenticates against `admin-api` and uses admin-only routes for management and inspection tasks. This stack is separate from the student-facing Node/TypeScript API rather than replacing it.

### Shared Backend

- Postgres remains the shared system of record
- the judge worker remains unchanged
- submission lifecycle terminology remains `queued -> running -> finished | failed`

The student API and the admin API read from and write to the same durable backend ecosystem, but they serve different operational purposes.

## MVP Scope

The Admin Web MVP is the first practical browser-based admin surface. Its scope is:

- analytics overview
- admin login
- problems list
- problem detail/edit
- tests management
- submissions list/detail

Implementation status at the time of this document:

- implemented: Microsoft OIDC admin login with local user mapping and TOTP hardening
- implemented: analytics overview
- implemented: problems list
- implemented: problem detail/edit
- implemented: tests management
- implemented: submissions list/detail
- implemented: platform user management

### Student-Facing vs Admin-Facing Operations

Student-facing operations:

- browse published problems
- open starter-backed files
- submit code
- inspect student-facing results and metrics

Admin-facing operations:

- inspect and edit problem metadata and content
- inspect and edit admin-visible public and hidden tests
- inspect submissions across users for operational review
- manage platform users, including role, status, and password reset

Hidden tests must remain admin-only. They may influence verdicts, but their raw inputs and expected outputs must not appear in student-facing routes, extension payloads, or student-focused documentation.

## Out Of Scope For This MVP

The Admin Web MVP does not include:

- contest features
- broad replacement of the student-facing Node/TypeScript API
- Google OIDC provider support
- recovery-code or helpdesk recovery workflows

It also does not change the judge pipeline, submission-state model, or the role of the VS Code extension as the student-facing client.

## Future Evolution

Likely future admin-facing expansions include:

- richer submissions operations such as rejudge actions
- 2FA / authenticator-based admin hardening
- richer dashboard and analytics views
- stronger deployment and operational hardening

Those are later expansions, not guarantees of current implementation.

## Admin Identity Hardening

Admin Web now supports two admin-only login modes:

- local email/password
- Microsoft OIDC

Both login modes converge into the same local admin authorization model:

- `admin-api` verifies either local credentials or the OIDC callback identity
- the login attempt must resolve to a local platform user
- local access still requires `role = admin` and `status = active`
- TOTP is enforced after local user verification or identity mapping, not before it

The student-facing VS Code extension remains student-only and does not participate in this admin login flow.

Current local login sequence:

`local email/password -> local user verification -> admin role/status check -> TOTP (if enabled) -> admin session`

Current Microsoft login sequence:

`Microsoft OIDC -> callback -> local user mapping -> admin role/status check -> TOTP (if enabled) -> admin session`

Current auth states exposed to Admin Web:

- `unauthenticated`
- `pending_tfa`
- `authenticated_admin`

Current denial states include:

- invalid local credentials
- Microsoft login failed
- callback invalid or expired
- external identity is not mapped to a local admin user
- mapped local user is disabled
- mapped local user is not an admin
- invalid or expired TOTP verification

## Local Mock OIDC Setup

For local development, `admin-api` supports a mock Microsoft OIDC mode so the full admin flow can be exercised without a live provider tenant.

Required `admin-api` env vars:

- `ADMIN_SESSION_SECRET`
- `ADMIN_WEB_BASE_URL`
- `ADMIN_MICROSOFT_CLIENT_ID`
- `ADMIN_MICROSOFT_REDIRECT_URI`
- `ADMIN_MICROSOFT_OIDC_MODE`
- `DATABASE_URL`

Optional mock-mode env vars:

- `ADMIN_MICROSOFT_MOCK_EMAIL`
- `ADMIN_MICROSOFT_MOCK_SUBJECT`
- `ADMIN_MICROSOFT_TENANT_ID`
- `ADMIN_TOTP_ISSUER`

Admin Web runtime env:

- `VITE_ADMIN_API_BASE_URL`

When `ADMIN_MICROSOFT_OIDC_MODE=mock`, the sign-in button still follows the full redirect/callback contract, but the provider exchange is resolved locally by `admin-api`.
