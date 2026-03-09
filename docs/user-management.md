# User Management MVP

This repository now includes a platform-level user management MVP for Admin Web and `admin-api`.

## Platform User Model

Each platform user has:

- `userId`
- `email`
- `displayName`
- `role`
- `status`
- `passwordHash`
- `createdAt`
- `updatedAt`
- `lastLoginAt` (optional)

Stored role values:

- `student`
- `admin`

Stored status values:

- `active`
- `disabled`

Rules:

- role and status are explicit fields
- `disabled` is a status, not a role
- passwords are stored as hashes, never plaintext

## Surface Boundaries

Student-facing surface:

- VS Code extension
- student-facing Node/TypeScript API

Admin-facing surface:

- Admin Web
- FastAPI `admin-api`

Admin-only user management lives only in the admin-facing surface. The student extension does not expose user-management operations.

## Admin API User Routes

The MVP exposes:

- `GET /admin/users`
- `GET /admin/users/{userId}`
- `POST /admin/users`
- `PUT /admin/users/{userId}`
- `POST /admin/users/{userId}/enable`
- `POST /admin/users/{userId}/disable`
- `POST /admin/users/{userId}/password`

These routes are admin-only.

## Admin Web User Pages

Admin Web provides:

- Users list page
- User detail/edit page

The list page supports:

- viewing platform users
- creating a user

The detail page supports:

- editing `displayName`
- editing `role`
- enabling or disabling the user
- setting or resetting the password

## Compatibility Notes

- The existing env-configured admin login path remains available for compatibility.
- Managed admin users can also authenticate through `admin-api`.
- Future 2FA can build on top of this user model, but 2FA is out of scope for this MVP.
