# Tasks

## 1. Architecture And Product Boundaries

- keep the extension documented as student-only
- keep Admin Web and `admin-api` documented as admin-only
- keep hidden tests off student-facing payloads and docs

## 2. Judge Pipeline And Runtime Metrics

- preserve explicit submission lifecycle states
- keep verdict semantics documented
- keep measured runtime metrics distinct from unavailable metrics
- keep worker failure cases documented as pipeline failures rather than verdicts

## 3. Problem Authoring Contract

- keep `manifest.json`, `statement.md`, `starter.py`, and `hidden.json` as the canonical problem files
- keep `entryFunction` aligned across authoring, import, and judging
- keep student-visible examples and public tests separate from hidden tests

## 4. Student Authentication

- keep student auth owned by the student API
- keep the extension account surface documented as the student auth entry point
- keep admin auth out of the student path

## 5. Admin Authentication And Operations

- keep local admin authorization mandatory
- keep TOTP documented as an admin-only control
- keep admin problem/test/submission/user workflows in the admin system

## 6. Documentation Maintenance

- keep README as the entry point only
- keep runtime metrics documented in a single dedicated doc
- delete duplicate setup guides and stale checklist docs when their content is consolidated
