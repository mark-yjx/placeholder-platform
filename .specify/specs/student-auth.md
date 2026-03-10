# Student Auth MVP

## Purpose

This spec defines the MVP student authentication direction for the student-facing product only:

- VS Code extension
- browser-based student auth pages
- Node/TypeScript student-facing API

It does not redesign admin auth and does not move student auth into `admin-api`.

## Product Boundary

The VS Code extension remains a student-only client.

Student authentication must therefore be separate from:

- Admin Web
- FastAPI `admin-api`
- admin-only identity hardening features

The extension must no longer treat admin auth as part of the student flow. Admins belong in Admin Web, and students belong in the extension plus student browser auth pages.

## Why browser-based auth replaces editor-embedded login

- Editor-embedded login is too constrained for a product-ready registration and sign-in experience.
- Browser pages are a better place for sign up, sign in, validation, account messaging, and later recovery flows.
- The extension should launch auth and consume the resulting student session rather than acting as a miniature account-management app.

## Backend Ownership

Student auth remains on the existing Node/TypeScript API.

Reasons:

- that API already serves the student-facing extension
- student auth should stay on the same backend as student session and student workflow behavior
- FastAPI remains admin-only in this phase

## MVP Login Modes

Student Auth MVP supports:

- browser-based sign up
- browser-based sign in

Student Auth MVP does not yet include:

- Google SSO
- Microsoft SSO
- GitHub SSO
- passwordless email login
- SMS login
- student 2FA

## Student Sign Up Contract

Required sign up fields:

- `email`
- `displayName`
- `password`
- `confirmPassword`

Planned sign up flow:

1. Student clicks `Sign up` from the extension.
2. The extension generates a callback URI and state for the pending auth attempt.
3. The extension opens the system browser to the student registration page on the Node/TypeScript API, including the callback initiation data.
4. The student enters the required registration fields.
5. The browser submits registration to the Node/TypeScript API.
6. On success, the platform creates the student account and completes the same callback-based return path used by sign in.

Successful registration behavior, MVP:

- registration completes on the web page
- the student is returned to the extension automatically through the callback flow when possible
- the extension completes student sign-in automatically after the final exchange
- if callback completion fails, fallback instructions may still be shown

## Student Sign In Contract

Required sign in fields:

- `email`
- `password`

Planned sign in flow:

1. Student clicks `Sign in` from the extension.
2. The extension generates a callback URI and state for the pending auth attempt.
3. The extension opens the system browser to the student login page on the Node/TypeScript API, including the callback initiation data.
4. The student enters `email` and `password`.
5. The browser submits credentials to the Node/TypeScript API.
6. On success, the platform redirects through the callback completion path back into the extension.

Successful login behavior, MVP:

- the browser confirms that authentication succeeded
- the extension receives the callback automatically when possible
- the extension obtains the real student session/token through the defined completion exchange
- after completion, the extension resumes the normal student workflow as an authenticated student client without manual paste

## Extension Integration

The extension must expose explicit student auth launch actions:

- `Sign in`
- `Sign up`

Planned integration contract:

- the extension opens the system browser rather than rendering an embedded email/password form in the editor area
- editor-area login is deprecated for student auth
- the extension registers a callback/URI handler for auth completion
- the extension sends callback URI and state when launching sign up or sign in
- the extension validates callback state before completing the final exchange
- after auth completes, the extension stores the resulting student session/token using the existing student token storage approach
- manual fallback instructions are shown only if callback completion fails

## Student API Callback Contract

The student-facing Node/TypeScript API must support callback-aware browser auth initiation.

Required responsibilities:

- accept a callback URI and state for student sign-up and sign-in initiation
- preserve or bind that initiation state through the browser auth flow
- after successful auth, redirect to the callback URI
- include a short-lived auth code or session completion proof in that redirect
- expose a final exchange path that turns that short-lived proof into the real student session/token used by the extension

The FastAPI admin stack remains out of scope for this contract.

## Session / Token Return Flow

Primary completion method:

- the extension initiates browser auth with callback URI and state
- the browser completes student sign up or sign in
- the student-facing API redirects to the callback URI
- the callback carries short-lived completion data such as an auth code or session completion token
- the extension validates callback state
- the extension exchanges the short-lived completion data for the real student session/token
- the extension updates to the authenticated student state automatically

Primary completion contract:

`extension launches browser with callback URI + state -> student signs up/signs in on web -> student API redirects to callback URI with short-lived completion proof -> extension validates state -> extension exchanges proof for student session -> authenticated student session`

Fallback completion method:

- manual code entry may remain available only when automatic callback completion fails
- the browser may show a one-time fallback code if the callback cannot be delivered or validated
- the extension may offer manual code entry only as a recovery path, not as the primary UX

Manual code copy/paste is therefore deprecated as the primary student auth completion path.

## Callback Security Model

- The callback URI should avoid carrying the final long-lived student access token directly when avoidable.
- The preferred callback payload is a short-lived auth code or session completion token.
- The short-lived completion payload should be one-time use and expire quickly.
- The extension must validate callback state against the pending auth attempt it initiated.
- The backend performs the final exchange into the real student session/token after validating the short-lived completion payload.

This keeps the browser redirect lightweight while leaving final session issuance on the normal API exchange path.

## Expected UX

- Student clicks `Sign in` or `Sign up` in the extension.
- The system browser opens the appropriate student auth page.
- After successful auth, the browser redirects back toward VS Code automatically.
- VS Code is reopened or focused by the callback handler when the platform and OS allow it.
- The extension completes sign-in automatically and refreshes to the signed-in state.
- The user sees manual instructions only if automatic callback completion fails.

## Unified Student Auth Rules

- student auth is browser-based in this MVP
- admin auth remains separate in Admin Web and `admin-api`
- the extension remains student-only
- the Node/TypeScript API remains the backend for student auth
- editor-embedded student login is deprecated
- automatic callback completion is the primary student auth UX
- manual code copy/paste is fallback-only behavior

## Out of Scope

- Google SSO
- Microsoft SSO for students
- GitHub SSO
- passwordless email login
- SMS login
- student 2FA
- major auth redesign for admin
