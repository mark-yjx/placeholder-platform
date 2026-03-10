# Admin Identity Hardening

## Purpose

This spec defines the next security phase for the admin-facing stack only:

- Admin Web
- `admin-api`

It does not redesign student authentication and does not change the judge pipeline.

## Supported Login Modes

Admin Web must support two primary login modes:

- local email/password
- Microsoft OIDC

Both login modes are admin-only entry paths. Neither mode may bypass local platform authorization or TOTP policy.

## Why both local login and OIDC

- Local email/password provides a platform-owned login path for deployments that need direct local admin access.
- Microsoft OIDC provides an SSO path for deployments that want provider-backed identity verification.
- The product requirement is not to pick one of these models exclusively, but to let both converge into the same local admin authorization and second-factor flow.

## Why OIDC terminology is still explicit

The Microsoft SSO path is an authentication problem, not just delegated authorization.

This phase uses OpenID Connect rather than generic "OAuth" terminology for the SSO path because the admin stack needs:

- a standard login redirect flow
- issuer and audience validation
- ID-token-backed identity claims
- discovery metadata
- callback semantics appropriate for browser login

Microsoft is the first provider. Google may be added later, but provider expansion must not change the local authorization model.

## Primary Provider Plan

Primary provider for the first implementation phase:

- Microsoft OIDC

Planned browser flow:

1. Admin Web starts an authorization-code flow with PKCE.
2. The identity provider returns to an Admin Web callback route.
3. Admin Web exchanges the code through `admin-api` or a server-owned callback flow.
4. `admin-api` validates the OIDC response and resolves the external identity.
5. The external identity is mapped to a local platform user.
6. If local mapping succeeds and the local user is eligible, the platform requires TOTP.
7. After successful TOTP, the platform issues the admin session.

Required scopes for the first provider plan:

- `openid`
- `profile`
- `email`

Required/expected claims:

- `iss`
- `sub`
- `aud`
- `exp`
- `iat`
- `email` when available
- `name` or equivalent display claim when available

The platform must not rely on Microsoft-specific admin-group semantics for final admission.

## Local Credential Flow

Planned browser flow:

1. Admin opens the Admin Web login page.
2. Admin submits local email and password.
3. `admin-api` verifies the local credential against the local platform user record.
4. The platform confirms the local user is eligible for Admin Web.
5. If the local user requires TOTP, the platform returns a pending second-factor state.
6. After successful TOTP, the platform issues the admin session.

The local login path is still subject to the same local authorization contract:

- `role = admin`
- `status = active`

## Local User Verification and Mapping Contract

Successful authentication by either primary mode does not, by itself, authorize admin access.

The platform must resolve the login to a local platform user. The local platform user remains the source of truth for:

- `userId`
- `role`
- `status`
- future TOTP enrollment state
- future recovery/reset state

For local email/password login:

- the local user is resolved directly by verified local credentials

For Microsoft OIDC login:

- the durable mapping key should be the external identity issuer + subject pair
- verified email may assist bootstrap or operator linking flows, but email alone must not be the long-term authorization key

Admin access requires all of the following:

- a mapped local platform user exists
- local `role = admin`
- local `status = active`

Access must be denied for:

- invalid local credentials
- unknown external identity
- resolved non-admin user
- resolved disabled user

This keeps admission provider-agnostic and lets the platform revoke access locally without waiting on provider-side policy changes.

## TOTP Contract

TOTP is the second factor for Admin Web after the platform has established the external identity and local user mapping.

Enrollment contract:

1. A mapped eligible admin user reaches the TOTP enrollment step.
2. The platform generates a TOTP secret for that local user.
3. The user scans a provisioning URI / QR code with an authenticator app.
4. The user confirms enrollment by submitting a valid TOTP code.
5. The platform stores only the protected secret material and enrollment state needed for later verification.

Verification contract:

1. The primary login succeeds, either by local credential verification or OIDC identity mapping.
2. The corresponding local user resolution succeeds.
3. The platform prompts for a TOTP code.
4. A valid code completes the admin login session.
5. An invalid code blocks session issuance.

Backup/recovery policy, minimum documented version:

- the platform should support one-time recovery codes and/or an explicit admin-assisted reset path
- recovery material must be treated as security credentials, not plaintext notes
- recovery handling belongs to the local platform account lifecycle, not to the external provider

TOTP must be enforced only after successful local user verification or identity mapping. The platform must not prompt for TOTP for unknown or ineligible users.

## Unified Admin Auth Rules

- External identity never grants admin access by itself.
- Successful local password verification never bypasses local admin authorization.
- Local `role` and `status` remain mandatory for both login modes.
- TOTP policy applies equally to both local login and Microsoft OIDC login.
- Unknown, disabled, or non-admin users must be rejected before session establishment.

## Planned Failure States

The hardened admin login flow must define and document at least these failures:

- invalid local credentials: local email/password does not verify
- unknown user: external identity authenticated, but no mapped local platform user exists
- disabled user: a local user was resolved, but local `status = disabled`
- non-admin user: a local user was resolved, but local `role != admin`
- invalid TOTP: primary authentication and local authorization passed, but second-factor verification failed

Each failure should be expressed as an intentional admin-auth state, not as a generic internal error.

## Boundary Rules

- The VS Code extension remains student-only.
- The student-facing Node/TypeScript API remains unchanged in this phase.
- The judge lifecycle remains `queued -> running -> finished | failed`.
- The platform user model remains platform-level and must not become course-specific.
