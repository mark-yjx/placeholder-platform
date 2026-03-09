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

- admin login
- problems list
- problem detail/edit
- tests management
- submissions list/detail

Implementation status at the time of this document:

- implemented: admin login
- implemented: problems list
- implemented: problem detail/edit
- planned within the same MVP scope: tests management
- planned within the same MVP scope: submissions list/detail

This means the MVP scope is finalized even though not every slice is complete yet.

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

Hidden tests must remain admin-only. They may influence verdicts, but their raw inputs and expected outputs must not appear in student-facing routes, extension payloads, or student-focused documentation.

## Out Of Scope For This MVP

The Admin Web MVP does not include:

- analytics dashboard
- user management
- 2FA or authenticator flows
- contest features
- broad replacement of the student-facing Node/TypeScript API

It also does not change the judge pipeline, submission-state model, or the role of the VS Code extension as the student-facing client.

## Future Evolution

Likely future admin-facing expansions include:

- richer submissions operations such as rejudge actions
- user and role management
- 2FA / authenticator-based admin hardening
- richer dashboard and analytics views
- stronger deployment and operational hardening

Those are later expansions, not guarantees of current implementation.
