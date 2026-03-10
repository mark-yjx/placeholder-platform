# Student Authentication

## Purpose

This spec defines the student authentication boundary for the student-facing product:

- VS Code extension
- student-facing API
- browser-based student auth pages

It does not move student auth into `admin-api` and it does not expand the extension into an admin client.

## Ownership

- the extension initiates student sign-in and sign-out from the account surface
- the student API owns student session creation and validation
- browser-based pages handle student credential collection and account flows

## Product Boundary

- the extension is student-only
- admin accounts belong in Admin Web
- `admin-api` remains admin-only

## Target Flow

1. The student starts authentication from the extension account surface.
2. The student-facing API owns the auth/session contract.
3. Browser-based auth pages handle credential entry and completion UX.
4. The extension stores the resulting student session state and resumes the student workflow.

## Session And Callback Rules

- callback or completion flows must remain student-facing API responsibilities
- the extension should validate that auth completions belong to the pending student flow
- the final long-lived student session should be established by the student API, not by raw redirect data alone

## Student Workflow Expectations

After successful auth, the student can:

- fetch published problems
- open starter-backed files
- run public tests locally
- submit solutions
- inspect student-visible results

## Non-Goals

- no admin auth in the extension
- no exposure of hidden tests
- no reuse of the admin session model for student auth
