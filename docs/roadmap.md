# Roadmap

This roadmap summarizes the major implementation phases tracked under `.specify/specs/tasks.md`.

## Completed Foundation

The repository already contains working slices for:

- npm workspace monorepo structure
- layered package boundaries
- environment validation
- API runtime and worker runtime entrypoints
- Postgres-backed local persistence
- problem import and manifest validation
- VSIX packaging
- sidebar-first extension workflow
- Docker-backed local development and smoke automation

## Major Delivered Phases

### Core Platform

- domain models for problems, submissions, verdicts, and identity
- application/use-case orchestration
- infrastructure adapters for Postgres-backed persistence

### API And Persistence

- auth routes and session/token flow
- published problem list/detail endpoints
- submission creation and result retrieval
- favorites, reviews, ranking, and stats endpoints

### Judge Pipeline

- queued job persistence
- worker queue consumption
- Docker sandbox execution
- Python runner plugin path
- persisted terminal results and polling

### VS Code Extension

- login flow
- problem browsing
- problem detail webview
- coding-file creation and reuse
- submit current file flow
- submissions list and submission detail panels

### Local Developer Experience

- compose-managed Postgres, API, and worker
- migration and seed helpers
- problem import script
- local smoke test
- VSIX packaging command

## Current Direction

The current repository direction is to keep improving the student-facing sidebar workflow while preserving the real API + worker execution path.

Areas that remain natural next steps include:

- richer release documentation and operational runbooks
- stronger extension polish and UX refinement
- more complete verdict coverage, including clearer resource-limit outcomes
- broader admin workflows and operational tooling
- additional observability and troubleshooting ergonomics

## How To Read The Full Plan

The detailed implementation backlog lives in:

- `.specify/specs/tasks.md`

The task file is organized as phased work, including:

- repo setup and contracts
- auth and RBAC
- problem CRUD and publication
- submission lifecycle and queue integration
- worker sandbox execution
- results/statistics/ranking
- extension UX hardening
- deployment and release readiness

## Practical Reading Order

If you are new to the repository, read in this order:

1. [README](../README.md)
2. [Architecture](./architecture.md)
3. [Local Development](./local-development.md)
4. [Extension Usage](./extension-usage.md)
5. [Judge Pipeline](./judge-pipeline.md)
6. [Problem Format](./problem-format.md)
