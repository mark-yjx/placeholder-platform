# Admin Authentication

## Purpose

This spec defines the admin-only authentication boundary for Admin Web and `admin-api`.

It does not redefine student authentication and it does not move admin access into the
student-facing API or the VS Code extension.

## Components

- Admin Web: browser-based admin frontend
- `admin-api`: admin-only authentication and operational backend
- shared platform user model in Postgres

## Primary Login Modes

Admin authentication supports two primary entry paths:

- local email/password
- Microsoft OIDC

Both flows converge into the same local authorization rules.

## Authorization Contract

Primary authentication is not enough by itself.

Admin access still requires:

- a local platform user
- `role = admin`
- `status = active`

An external provider identity never grants admin access by itself.

## TOTP Contract

If the resolved admin user has TOTP enabled:

1. primary login succeeds
2. local admin authorization succeeds
3. the session enters `pending_tfa`
4. a valid TOTP code upgrades the session to `authenticated_admin`

## Session States

- `unauthenticated`
- `pending_tfa`
- `authenticated_admin`

## Failure States

At minimum, the admin system must distinguish:

- invalid local credentials
- invalid or expired provider callback
- unknown external identity
- resolved user is not an admin
- resolved user is disabled
- invalid or expired TOTP verification

## Boundary Rules

- Admin auth belongs to Admin Web and `admin-api`.
- Student auth belongs to the student API and extension account flow.
- The extension remains a student-only client.
- Hidden tests and cross-user operations stay off the student path.

## Non-Goals

- no student auth redesign here
- no unification of student and admin sessions
- no admin workflow inside the extension
