# Admin Web

Admin Web is the browser-based administrator client for the Online Judge.

## Product Boundary

- Admin Web is the admin-facing frontend.
- The VS Code extension is student-only.
- Administrators must use Admin Web instead of the extension.

Admin workflows need different data visibility, editing flows, and access controls from student practice workflows. That is why the project now uses a separate admin frontend and a separate admin API.

## Current Architecture

Admin stack:

- frontend: `apps/admin-web`
- API: `apps/admin-api`

Shared backend:

- Postgres
- existing judge worker

Student stack, kept separate:

- `apps/vscode-extension`
- `apps/api`

## Admin Responsibilities

Admin Web is the place for administrator workflows such as:

- problem management
- public test editing
- hidden test editing
- submission inspection
- admin-only failure detail inspection

Those workflows must not live in the student extension.

## Current MVP Scope

The current Admin Web MVP includes:

- admin login
- problems list
- problem detail and edit
- tests management with separate public and hidden sections
- submissions list
- submission detail inspection

These implemented pages provide the first working admin flow without changing the student-facing extension or judge lifecycle.

## Problem Management

Admin problem management is the broader responsibility area for Admin Web.

Current implemented problem-management capabilities:

- list problems
- inspect a problem
- edit problem metadata
- edit statement markdown
- edit starter code

Broader CRUD remains the long-term admin boundary, but the currently implemented MVP is focused on list and edit rather than full create/delete flows.

## Tests Management

Admin Web separates:

- public tests
- hidden tests

That separation is intentional:

- public tests are visible execution cases
- hidden tests are judge-only and admin-only

Hidden tests must remain inaccessible to student-facing routes and the VS Code extension.

## Submission Inspection

Admin Web supports operational inspection of submissions across users.

Current inspection scope includes:

- submission metadata
- owner user
- problem ID
- submission status
- verdict
- runtime metrics
- failure or error detail when it is truly available

This is different from the student experience, which is limited to the student's own submissions.

## Hidden Failure Detail

Admin-facing inspection may include failure detail that is not appropriate for student-facing views. That does not change the student contract:

- students must not see hidden tests
- students must not see hidden-case inputs or expected outputs

Admin Web exists partly to keep that operational visibility separate from student UX.

## Out Of Scope

The current Admin Web MVP does not include:

- analytics dashboard
- user management
- 2FA
- contest features
- replacement of the student-facing Node API

Those remain future expansion areas, not current implementation claims.
