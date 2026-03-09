# admin-web

Minimal React + TypeScript + Vite scaffold for the admin-facing web UI.

Current MVP auth flow:

- local email/password form posts to `POST /admin/auth/login`
- `Sign in with Microsoft` redirects through `GET /admin/auth/login/microsoft`
- stores only the signed admin token in `localStorage`
- restores the admin session by calling `GET /admin/auth/me`
- redirects unauthenticated users to `/login`
- redirects `pending_tfa` sessions to `/verify-totp`
- loads the protected problems list from `GET /admin/problems`

## Run locally

From the repository root:

```bash
npm install
export VITE_ADMIN_API_BASE_URL=http://127.0.0.1:8200
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

## Test

```bash
npm -w @apps/admin-web run test
```

Token storage policy:

- only the signed admin bearer token is stored in browser `localStorage`
- plaintext credentials are never written to browser storage
- the stored token is cleared on logout or when `/admin/auth/me` rejects the session

The root protected page currently shows the admin problems list with:

- `Problem ID`
- `Title`
- `Visibility`
- `Updated At`

The list includes a refresh action and simple loading, empty, and error states.
