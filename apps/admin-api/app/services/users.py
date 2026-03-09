from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.users import (
    AdminUserCreateRequest,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserUpdateRequest,
    UserStatus,
)

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"

LIST_USERS_SQL = """
SELECT
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
FROM users
ORDER BY created_at DESC, id DESC
"""

GET_USER_SQL = """
SELECT
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
FROM users
WHERE id = %(user_id)s
"""

GET_USER_AUTH_SQL = """
SELECT
  id AS user_id,
  email,
  display_name,
  role,
  status,
  password_hash,
  created_at,
  updated_at,
  last_login_at
FROM users
WHERE email = %(email)s
LIMIT 1
"""

INSERT_USER_SQL = """
INSERT INTO users (
  id,
  email,
  display_name,
  role,
  status,
  password_hash,
  created_at,
  updated_at
)
VALUES (
  %(user_id)s,
  %(email)s,
  %(display_name)s,
  %(role)s,
  %(status)s,
  %(password_hash)s,
  NOW(),
  NOW()
)
RETURNING
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
"""

UPDATE_USER_SQL = """
UPDATE users
SET display_name = %(display_name)s,
    role = %(role)s,
    status = %(status)s,
    updated_at = NOW()
WHERE id = %(user_id)s
RETURNING
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
"""

UPDATE_USER_STATUS_SQL = """
UPDATE users
SET status = %(status)s,
    updated_at = NOW()
WHERE id = %(user_id)s
RETURNING
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
"""

UPDATE_USER_PASSWORD_SQL = """
UPDATE users
SET password_hash = %(password_hash)s,
    updated_at = NOW()
WHERE id = %(user_id)s
RETURNING
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
"""

UPDATE_LAST_LOGIN_SQL = """
UPDATE users
SET last_login_at = NOW(),
    updated_at = NOW()
WHERE id = %(user_id)s
RETURNING
  id AS user_id,
  email,
  display_name,
  role,
  status,
  created_at,
  updated_at,
  last_login_at
"""


class AdminUserService(Protocol):
    def list_users(self) -> list[AdminUserListItem]:
        ...

    def get_user(self, user_id: str) -> AdminUserDetail | None:
        ...

    def create_user(self, payload: AdminUserCreateRequest) -> AdminUserDetail:
        ...

    def update_user(
        self, user_id: str, payload: AdminUserUpdateRequest
    ) -> AdminUserDetail | None:
        ...

    def set_user_status(self, user_id: str, status: UserStatus) -> AdminUserDetail | None:
        ...

    def set_user_password(self, user_id: str, password: str) -> AdminUserDetail | None:
        ...

    def authenticate_admin(self, email: str, password: str) -> AdminUserDetail | None:
        ...


class UserAlreadyExistsError(ValueError):
    """Raised when a user email collides with an existing account."""


class UserOperationValidationError(ValueError):
    """Raised when user management input violates the MVP contract."""


def hash_password(password: str, salt: str | None = None) -> str:
    normalized = password.strip()
    if len(normalized) < 8:
        raise UserOperationValidationError("Password must be at least 8 characters long.")

    resolved_salt = salt or secrets.token_hex(16)
    derived = hashlib.scrypt(
        normalized.encode("utf-8"),
        salt=resolved_salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    )
    return f"scrypt${resolved_salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, salt, expected_hash = stored_hash.split("$", 2)
    except ValueError:
        return False

    if scheme != "scrypt" or not salt or not expected_hash:
        return False

    candidate = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    return secrets.compare_digest(candidate, expected_hash)


@dataclass(frozen=True)
class PsycopgAdminUserService:
    database_url: str

    @classmethod
    def from_env(cls) -> "PsycopgAdminUserService":
        return cls(database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))

    def list_users(self) -> list[AdminUserListItem]:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(LIST_USERS_SQL)
                rows = cursor.fetchall()

        return [_row_to_user_list_item(row) for row in rows]

    def get_user(self, user_id: str) -> AdminUserDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(GET_USER_SQL, {"user_id": user_id})
                row = cursor.fetchone()

        return _row_to_user_detail(row) if row else None

    def create_user(self, payload: AdminUserCreateRequest) -> AdminUserDetail:
        user_id = f"user-{uuid.uuid4().hex[:12]}"
        params = {
            "user_id": user_id,
            "email": payload.email.strip().lower(),
            "display_name": payload.displayName.strip(),
            "role": payload.role,
            "status": payload.status,
            "password_hash": hash_password(payload.password),
        }

        try:
            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(INSERT_USER_SQL, params)
                    row = cursor.fetchone()
                connection.commit()
        except psycopg.errors.UniqueViolation as exc:
            raise UserAlreadyExistsError("A user with that email already exists.") from exc

        if row is None:
            raise RuntimeError("User creation did not return a persisted user row.")

        return _row_to_user_detail(row)

    def update_user(
        self, user_id: str, payload: AdminUserUpdateRequest
    ) -> AdminUserDetail | None:
        params = {
            "user_id": user_id,
            "display_name": payload.displayName.strip(),
            "role": payload.role,
            "status": payload.status,
        }
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(UPDATE_USER_SQL, params)
                row = cursor.fetchone()
            connection.commit()

        return _row_to_user_detail(row) if row else None

    def set_user_status(self, user_id: str, status: UserStatus) -> AdminUserDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(UPDATE_USER_STATUS_SQL, {"user_id": user_id, "status": status})
                row = cursor.fetchone()
            connection.commit()

        return _row_to_user_detail(row) if row else None

    def set_user_password(self, user_id: str, password: str) -> AdminUserDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    UPDATE_USER_PASSWORD_SQL,
                    {"user_id": user_id, "password_hash": hash_password(password)},
                )
                row = cursor.fetchone()
            connection.commit()

        return _row_to_user_detail(row) if row else None

    def authenticate_admin(self, email: str, password: str) -> AdminUserDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(GET_USER_AUTH_SQL, {"email": email.strip().lower()})
                row = cursor.fetchone()

                if row is None:
                    return None
                if row["role"] != "admin" or row["status"] != "active":
                    return None
                if not verify_password(password, str(row["password_hash"])):
                    return None

                cursor.execute(UPDATE_LAST_LOGIN_SQL, {"user_id": row["user_id"]})
                refreshed = cursor.fetchone()
            connection.commit()

        return _row_to_user_detail(refreshed or row)


def _row_to_user_list_item(row: dict) -> AdminUserListItem:
    return AdminUserListItem(
        userId=str(row["user_id"]),
        email=str(row["email"]),
        displayName=str(row["display_name"]),
        role=str(row["role"]),
        status=str(row["status"]),
        createdAt=_format_timestamp(row["created_at"]),
    )


def _row_to_user_detail(row: dict) -> AdminUserDetail:
    return AdminUserDetail(
        userId=str(row["user_id"]),
        email=str(row["email"]),
        displayName=str(row["display_name"]),
        role=str(row["role"]),
        status=str(row["status"]),
        createdAt=_format_timestamp(row["created_at"]),
        updatedAt=_format_timestamp(row["updated_at"]),
        lastLoginAt=_format_timestamp(row["last_login_at"]) if row["last_login_at"] else None,
    )


def _format_timestamp(value: datetime | str) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)
