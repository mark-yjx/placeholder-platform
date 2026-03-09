# admin-web

Minimal React + TypeScript + Vite scaffold for the admin-facing web UI.

## Run locally

From the repository root:

```bash
npm install
npm -w @apps/admin-web run dev
```

By default Vite serves the app on `http://127.0.0.1:5173`.

## Build

```bash
npm -w @apps/admin-web run build
```

## Typecheck

```bash
npm -w @apps/admin-web run typecheck
```

There is no dedicated frontend test harness for `admin-web` yet, so this scaffold keeps validation to the repository gate plus the app-specific build and local startup checks.
