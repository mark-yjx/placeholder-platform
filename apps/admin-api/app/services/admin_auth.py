from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import httpx
import psycopg
from psycopg.rows import dict_row

from app.core.auth import (
    AdminAuthSettings,
    AdminIdentity,
    AdminSessionToken,
    OidcFlowState,
    build_pkce_code_challenge,
    create_oidc_flow_token,
    create_session_token,
    load_admin_auth_settings,
    verify_oidc_flow_token,
    verify_session_token,
)

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"

ENSURE_ADMIN_IDENTITY_MAPPINGS_SQL = """
CREATE TABLE IF NOT EXISTS admin_identity_mappings (
  provider TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, issuer, subject),
  UNIQUE (user_id, provider)
)
"""

ENSURE_ADMIN_TOTP_SETTINGS_SQL = """
CREATE TABLE IF NOT EXISTS admin_totp_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

ENSURE_ADMIN_SESSIONS_SQL = """
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  provider TEXT NOT NULL,
  session_state TEXT NOT NULL CHECK (session_state IN ('pending_tfa', 'authenticated_admin')),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  totp_verified_at TIMESTAMPTZ
)
"""

ENSURE_ADMIN_SESSIONS_USER_ID_IDX_SQL = """
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions (user_id)
"""

GET_MAPPING_BY_SUBJECT_SQL = """
SELECT
  m.user_id,
  m.email AS mapped_email,
  u.email,
  u.display_name,
  u.role,
  u.status,
  COALESCE(t.user_id IS NOT NULL, FALSE) AS totp_enabled
FROM admin_identity_mappings m
JOIN users u ON u.id = m.user_id
LEFT JOIN admin_totp_settings t ON t.user_id = u.id
WHERE m.provider = %(provider)s
  AND m.issuer = %(issuer)s
  AND m.subject = %(subject)s
LIMIT 1
"""

GET_ADMIN_USER_BY_EMAIL_SQL = """
SELECT
  u.id AS user_id,
  u.email,
  u.display_name,
  u.role,
  u.status,
  COALESCE(t.user_id IS NOT NULL, FALSE) AS totp_enabled
FROM users u
LEFT JOIN admin_totp_settings t ON t.user_id = u.id
WHERE lower(u.email) = lower(%(email)s)
LIMIT 1
"""

GET_ADMIN_USER_BY_ID_SQL = """
SELECT
  u.id AS user_id,
  u.email,
  u.display_name,
  u.role,
  u.status,
  COALESCE(t.user_id IS NOT NULL, FALSE) AS totp_enabled
FROM users u
LEFT JOIN admin_totp_settings t ON t.user_id = u.id
WHERE u.id = %(user_id)s
LIMIT 1
"""

UPSERT_MAPPING_SQL = """
INSERT INTO admin_identity_mappings (
  provider,
  issuer,
  subject,
  user_id,
  email,
  created_at,
  updated_at
)
VALUES (
  %(provider)s,
  %(issuer)s,
  %(subject)s,
  %(user_id)s,
  %(email)s,
  NOW(),
  NOW()
)
ON CONFLICT (provider, issuer, subject) DO UPDATE
SET user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    updated_at = NOW()
"""

INSERT_SESSION_SQL = """
INSERT INTO admin_sessions (
  id,
  user_id,
  email,
  provider,
  session_state,
  expires_at,
  created_at,
  updated_at,
  totp_verified_at
)
VALUES (
  %(session_id)s,
  %(user_id)s,
  %(email)s,
  %(provider)s,
  %(session_state)s,
  %(expires_at)s,
  NOW(),
  NOW(),
  %(totp_verified_at)s
)
"""

GET_SESSION_SQL = """
SELECT
  s.id AS session_id,
  s.user_id,
  s.email,
  s.session_state,
  s.expires_at,
  s.revoked_at,
  u.role,
  u.status,
  COALESCE(t.user_id IS NOT NULL, FALSE) AS totp_enabled
FROM admin_sessions s
JOIN users u ON u.id = s.user_id
LEFT JOIN admin_totp_settings t ON t.user_id = u.id
WHERE s.id = %(session_id)s
LIMIT 1
"""

PROMOTE_SESSION_SQL = """
UPDATE admin_sessions
SET session_state = 'authenticated_admin',
    updated_at = NOW(),
    totp_verified_at = NOW()
WHERE id = %(session_id)s
"""

REVOKE_SESSION_SQL = """
UPDATE admin_sessions
SET revoked_at = NOW(),
    updated_at = NOW()
WHERE id = %(session_id)s AND revoked_at IS NULL
"""

INSERT_TOTP_SETTING_SQL = """
INSERT INTO admin_totp_settings (
  user_id,
  enabled_at,
  created_at,
  updated_at
)
VALUES (
  %(user_id)s,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING
"""

GET_TOTP_SETTING_SQL = """
SELECT user_id, enabled_at
FROM admin_totp_settings
WHERE user_id = %(user_id)s
LIMIT 1
"""

UPDATE_LAST_LOGIN_SQL = """
UPDATE users
SET last_login_at = NOW(),
    updated_at = NOW()
WHERE id = %(user_id)s
"""


class AdminOidcError(ValueError):
    """Raised when the OIDC provider flow fails safely."""


class LocalUserMappingError(ValueError):
    """Raised when an external identity cannot enter Admin Web."""


class TotpVerificationError(ValueError):
    """Raised when a TOTP operation fails."""


@dataclass(frozen=True)
class ExternalAdminIdentity:
    provider: str
    issuer: str
    subject: str
    email: str | None
    display_name: str | None = None


@dataclass(frozen=True)
class LocalAdminUser:
    user_id: str
    email: str
    display_name: str
    role: str
    status: str
    totp_enabled: bool


@dataclass(frozen=True)
class AdminAuthSession:
    state: str
    token: str | None
    user: AdminIdentity | None
    pending_expires_at: str | None = None


@dataclass(frozen=True)
class TotpEnrollment:
    secret: str
    otpauth_uri: str
    issuer: str
    account_name: str


class AdminAuthService(Protocol):
    def create_oidc_flow(self) -> tuple[str, str]:
        ...

    def complete_oidc_callback(
        self, *, provider: str, code: str, flow_token: str
    ) -> AdminAuthSession:
        ...

    def get_session_state(self, token: str | None) -> AdminAuthSession:
        ...

    def require_authenticated_admin(self, token: str) -> AdminIdentity:
        ...

    def verify_pending_totp(self, token: str, code: str) -> AdminAuthSession:
        ...

    def init_totp_enrollment(self, token: str) -> TotpEnrollment:
        ...

    def confirm_totp_enrollment(self, token: str, code: str) -> None:
        ...

    def logout(self, token: str | None) -> None:
        ...


@dataclass(frozen=True)
class UnconfiguredAdminAuthService:
    detail: str

    def create_oidc_flow(self) -> tuple[str, str]:
        raise AdminAuthConfigError(self.detail)

    def complete_oidc_callback(
        self, *, provider: str, code: str, flow_token: str
    ) -> AdminAuthSession:
        raise AdminAuthConfigError(self.detail)

    def get_session_state(self, token: str | None) -> AdminAuthSession:
        return AdminAuthSession(state="unauthenticated", token=None, user=None)

    def require_authenticated_admin(self, token: str) -> AdminIdentity:
        raise AdminAuthConfigError(self.detail)

    def verify_pending_totp(self, token: str, code: str) -> AdminAuthSession:
        raise AdminAuthConfigError(self.detail)

    def init_totp_enrollment(self, token: str) -> TotpEnrollment:
        raise AdminAuthConfigError(self.detail)

    def confirm_totp_enrollment(self, token: str, code: str) -> None:
        raise AdminAuthConfigError(self.detail)

    def logout(self, token: str | None) -> None:
        return None


class MicrosoftOidcService(Protocol):
    def build_authorization_url(
        self,
        *,
        state_token: str,
        code_challenge: str,
        nonce: str,
    ) -> str:
        ...

    def exchange_code(
        self,
        *,
        code: str,
        code_verifier: str,
        nonce: str,
    ) -> ExternalAdminIdentity:
        ...


@dataclass(frozen=True)
class ConfiguredMicrosoftOidcService:
    settings: AdminAuthSettings

    def build_authorization_url(
        self,
        *,
        state_token: str,
        code_challenge: str,
        nonce: str,
    ) -> str:
        if self.settings.microsoft_oidc_mode == "mock":
            query = urllib.parse.urlencode({"code": "mock-admin", "state": state_token})
            return f"{self.settings.microsoft_redirect_uri}?{query}"

        authorize_url = (
            f"https://login.microsoftonline.com/{self.settings.microsoft_tenant_id}"
            "/oauth2/v2.0/authorize"
        )
        query = urllib.parse.urlencode(
            {
                "client_id": self.settings.microsoft_client_id,
                "response_type": "code",
                "redirect_uri": self.settings.microsoft_redirect_uri,
                "response_mode": "query",
                "scope": "openid profile email",
                "state": state_token,
                "nonce": nonce,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            }
        )
        return f"{authorize_url}?{query}"

    def exchange_code(
        self,
        *,
        code: str,
        code_verifier: str,
        nonce: str,
    ) -> ExternalAdminIdentity:
        if self.settings.microsoft_oidc_mode == "mock":
            if code != "mock-admin":
                raise AdminOidcError("Microsoft login failed.")
            return ExternalAdminIdentity(
                provider="microsoft",
                issuer=f"https://login.microsoftonline.com/{self.settings.microsoft_tenant_id}/v2.0",
                subject=self.settings.microsoft_mock_subject,
                email=self.settings.microsoft_mock_email,
                display_name="Mock Microsoft Admin",
            )

        token_url = (
            f"https://login.microsoftonline.com/{self.settings.microsoft_tenant_id}"
            "/oauth2/v2.0/token"
        )
        response = httpx.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "client_id": self.settings.microsoft_client_id,
                "client_secret": self.settings.microsoft_client_secret,
                "code": code,
                "redirect_uri": self.settings.microsoft_redirect_uri,
                "code_verifier": code_verifier,
            },
            timeout=10.0,
        )
        if response.status_code >= 400:
            raise AdminOidcError("Microsoft login failed.")

        body = response.json()
        id_token = body.get("id_token")
        if not isinstance(id_token, str) or not id_token:
            raise AdminOidcError("Microsoft login failed.")

        claims = _decode_jwt_claims(id_token)
        if not isinstance(claims.get("sub"), str) or not claims["sub"]:
            raise AdminOidcError("Microsoft login failed.")
        if not isinstance(claims.get("iss"), str) or not claims["iss"]:
            raise AdminOidcError("Microsoft login failed.")
        if claims.get("aud") != self.settings.microsoft_client_id:
            raise AdminOidcError("Microsoft login failed.")
        if not isinstance(claims.get("exp"), int) or claims["exp"] < int(time.time()):
            raise AdminOidcError("Microsoft login failed.")
        if claims.get("nonce") != nonce:
            raise AdminOidcError("Microsoft login failed.")

        email = claims.get("email")
        if not isinstance(email, str) or not email:
            email = claims.get("preferred_username")
        if email is not None and not isinstance(email, str):
            email = None

        display_name = claims.get("name")
        if display_name is not None and not isinstance(display_name, str):
            display_name = None

        return ExternalAdminIdentity(
            provider="microsoft",
            issuer=claims["iss"],
            subject=claims["sub"],
            email=email,
            display_name=display_name,
        )


@dataclass(frozen=True)
class PsycopgAdminAuthService:
    database_url: str
    settings: AdminAuthSettings
    oidc_service: MicrosoftOidcService

    @classmethod
    def from_env(cls, oidc_service: MicrosoftOidcService | None = None) -> "PsycopgAdminAuthService":
        settings = load_admin_auth_settings()
        service = cls(
            database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
            settings=settings,
            oidc_service=oidc_service or ConfiguredMicrosoftOidcService(settings),
        )
        service.ensure_schema()
        return service

    def ensure_schema(self) -> None:
        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(ENSURE_ADMIN_IDENTITY_MAPPINGS_SQL)
                cursor.execute(ENSURE_ADMIN_TOTP_SETTINGS_SQL)
                cursor.execute(ENSURE_ADMIN_SESSIONS_SQL)
                cursor.execute(ENSURE_ADMIN_SESSIONS_USER_ID_IDX_SQL)
            connection.commit()

    def create_oidc_flow(self) -> tuple[str, str]:
        state = secrets.token_urlsafe(24)
        nonce = secrets.token_urlsafe(24)
        code_verifier = secrets.token_urlsafe(48)
        flow_token = create_oidc_flow_token(
            state=state,
            nonce=nonce,
            code_verifier=code_verifier,
            token_secret=self.settings.session_secret,
        )
        auth_url = self.oidc_service.build_authorization_url(
            state_token=flow_token,
            code_challenge=build_pkce_code_challenge(code_verifier),
            nonce=nonce,
        )
        return flow_token, auth_url

    def complete_oidc_callback(
        self, *, provider: str, code: str, flow_token: str
    ) -> AdminAuthSession:
        flow = verify_oidc_flow_token(flow_token, self.settings.session_secret)
        if flow is None:
            raise AdminOidcError("Microsoft callback is invalid or expired.")

        external_identity = self.oidc_service.exchange_code(
            code=code,
            code_verifier=flow.code_verifier,
            nonce=flow.nonce,
        )
        if external_identity.provider != provider:
            raise AdminOidcError("Microsoft login failed.")

        local_user = self._resolve_local_user(external_identity)
        session_state = "pending_tfa" if local_user.totp_enabled else "authenticated_admin"
        session = self._create_session(local_user, provider, session_state)

        if session_state == "authenticated_admin":
            self._touch_last_login(local_user.user_id)

        token = create_session_token(
            session_id=session["session_id"],
            state=session_state,
            email=local_user.email,
            user_id=local_user.user_id,
            token_secret=self.settings.session_secret,
            expires_in_seconds=(
                self.settings.pending_tfa_ttl_seconds
                if session_state == "pending_tfa"
                else self.settings.session_ttl_seconds
            ),
        )

        return AdminAuthSession(
            state=session_state,
            token=token,
            user=AdminIdentity(
                email=local_user.email,
                user_id=local_user.user_id,
                totp_enabled=local_user.totp_enabled,
            ),
            pending_expires_at=_format_timestamp(session["expires_at"])
            if session_state == "pending_tfa"
            else None,
        )

    def get_session_state(self, token: str | None) -> AdminAuthSession:
        if not token:
            return AdminAuthSession(state="unauthenticated", token=None, user=None)

        session_token = verify_session_token(token, self.settings.session_secret)
        if session_token is None:
            return AdminAuthSession(state="unauthenticated", token=None, user=None)

        session = self._get_session(session_token.session_id)
        if session is None or session["revoked_at"] is not None:
            return AdminAuthSession(state="unauthenticated", token=None, user=None)
        if _is_expired(session["expires_at"]):
            self._revoke_session(session_token.session_id)
            return AdminAuthSession(state="unauthenticated", token=None, user=None)
        if session["status"] != "active":
            return AdminAuthSession(state="unauthenticated", token=None, user=None)
        if session["role"] != "admin":
            return AdminAuthSession(state="unauthenticated", token=None, user=None)

        identity = AdminIdentity(
            email=session["email"],
            user_id=session["user_id"],
            totp_enabled=bool(session["totp_enabled"]),
        )

        if session["session_state"] == "pending_tfa":
            return AdminAuthSession(
                state="pending_tfa",
                token=token,
                user=identity,
                pending_expires_at=_format_timestamp(session["expires_at"]),
            )

        return AdminAuthSession(
            state="authenticated_admin",
            token=token,
            user=identity,
        )

    def require_authenticated_admin(self, token: str) -> AdminIdentity:
        session_state = self.get_session_state(token)
        if session_state.state != "authenticated_admin" or session_state.user is None:
            raise ValueError("Invalid admin token.")
        return session_state.user

    def verify_pending_totp(self, token: str, code: str) -> AdminAuthSession:
        session_token = verify_session_token(token, self.settings.session_secret)
        if session_token is None or session_token.state != "pending_tfa":
            raise TotpVerificationError("Pending admin verification is missing or expired.")

        session = self._get_session(session_token.session_id)
        if session is None or session["revoked_at"] is not None or _is_expired(session["expires_at"]):
            raise TotpVerificationError("Pending admin verification is missing or expired.")
        if session["session_state"] != "pending_tfa":
            raise TotpVerificationError("Pending admin verification is missing or expired.")

        user = self._get_user_by_id(session["user_id"])
        if user is None:
            raise TotpVerificationError("Pending admin verification is missing or expired.")
        if user.role != "admin":
            raise TotpVerificationError("Admin access is limited to local admin users.")
        if user.status != "active":
            raise TotpVerificationError("This admin account is disabled.")
        if not user.totp_enabled:
            raise TotpVerificationError("TOTP is not enabled for this admin account.")
        if not _verify_totp_code(self._derive_totp_secret(user.user_id), code):
            raise TotpVerificationError("Invalid TOTP code.")

        self._promote_session(session_token.session_id)
        self._touch_last_login(user.user_id)

        authenticated_token = create_session_token(
            session_id=session_token.session_id,
            state="authenticated_admin",
            email=user.email,
            user_id=user.user_id,
            token_secret=self.settings.session_secret,
            expires_in_seconds=self.settings.session_ttl_seconds,
        )
        return AdminAuthSession(
            state="authenticated_admin",
            token=authenticated_token,
            user=AdminIdentity(email=user.email, user_id=user.user_id, totp_enabled=True),
        )

    def init_totp_enrollment(self, token: str) -> TotpEnrollment:
        identity = self.require_authenticated_admin(token)
        user = self._get_user_by_id(identity.user_id)
        if user is None or user.status != "active" or user.role != "admin":
            raise TotpVerificationError("Admin session is invalid.")
        if user.totp_enabled:
            raise TotpVerificationError("TOTP is already enabled for this admin account.")

        secret = self._derive_totp_secret(user.user_id)
        account_name = user.email
        issuer = self.settings.totp_issuer
        label = urllib.parse.quote(f"{issuer}:{account_name}")
        otpauth_uri = (
            f"otpauth://totp/{label}"
            f"?secret={urllib.parse.quote(secret)}"
            f"&issuer={urllib.parse.quote(issuer)}"
            "&algorithm=SHA1&digits=6&period=30"
        )
        return TotpEnrollment(
            secret=secret,
            otpauth_uri=otpauth_uri,
            issuer=issuer,
            account_name=account_name,
        )

    def confirm_totp_enrollment(self, token: str, code: str) -> None:
        identity = self.require_authenticated_admin(token)
        user = self._get_user_by_id(identity.user_id)
        if user is None or user.status != "active" or user.role != "admin":
            raise TotpVerificationError("Admin session is invalid.")
        if user.totp_enabled:
            raise TotpVerificationError("TOTP is already enabled for this admin account.")
        if not _verify_totp_code(self._derive_totp_secret(user.user_id), code):
            raise TotpVerificationError("Invalid TOTP code.")

        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(INSERT_TOTP_SETTING_SQL, {"user_id": user.user_id})
            connection.commit()

    def logout(self, token: str | None) -> None:
        if not token:
            return
        session_token = verify_session_token(token, self.settings.session_secret)
        if session_token is None:
            return
        self._revoke_session(session_token.session_id)

    def _resolve_local_user(self, identity: ExternalAdminIdentity) -> LocalAdminUser:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    GET_MAPPING_BY_SUBJECT_SQL,
                    {
                        "provider": identity.provider,
                        "issuer": identity.issuer,
                        "subject": identity.subject,
                    },
                )
                mapped_row = cursor.fetchone()
                if mapped_row is not None:
                    user = _row_to_local_admin_user(mapped_row)
                elif identity.email:
                    cursor.execute(GET_ADMIN_USER_BY_EMAIL_SQL, {"email": identity.email})
                    email_row = cursor.fetchone()
                    user = _row_to_local_admin_user(email_row) if email_row else None
                    if user is not None:
                        cursor.execute(
                            UPSERT_MAPPING_SQL,
                            {
                                "provider": identity.provider,
                                "issuer": identity.issuer,
                                "subject": identity.subject,
                                "user_id": user.user_id,
                                "email": identity.email,
                            },
                        )
                else:
                    user = None
            connection.commit()

        if user is None:
            raise LocalUserMappingError("Microsoft identity is not mapped to a local admin user.")
        if user.role != "admin":
            raise LocalUserMappingError("Admin access is limited to local admin users.")
        if user.status != "active":
            raise LocalUserMappingError("This admin account is disabled.")

        return user

    def _create_session(
        self,
        user: LocalAdminUser,
        provider: str,
        session_state: str,
    ) -> dict[str, object]:
        session_id = f"admin-session-{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc).timestamp() + (
            self.settings.pending_tfa_ttl_seconds
            if session_state == "pending_tfa"
            else self.settings.session_ttl_seconds
        )
        expires_at_dt = datetime.fromtimestamp(expires_at, tz=timezone.utc)

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    INSERT_SESSION_SQL,
                    {
                        "session_id": session_id,
                        "user_id": user.user_id,
                        "email": user.email,
                        "provider": provider,
                        "session_state": session_state,
                        "expires_at": expires_at_dt,
                        "totp_verified_at": None
                        if session_state == "pending_tfa"
                        else datetime.now(timezone.utc),
                    },
                )
            connection.commit()

        return {"session_id": session_id, "expires_at": expires_at_dt}

    def _get_session(self, session_id: str) -> dict[str, object] | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(GET_SESSION_SQL, {"session_id": session_id})
                row = cursor.fetchone()
        return row

    def _revoke_session(self, session_id: str) -> None:
        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(REVOKE_SESSION_SQL, {"session_id": session_id})
            connection.commit()

    def _promote_session(self, session_id: str) -> None:
        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(PROMOTE_SESSION_SQL, {"session_id": session_id})
            connection.commit()

    def _touch_last_login(self, user_id: str) -> None:
        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(UPDATE_LAST_LOGIN_SQL, {"user_id": user_id})
            connection.commit()

    def _get_user_by_id(self, user_id: str) -> LocalAdminUser | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(GET_ADMIN_USER_BY_ID_SQL, {"user_id": user_id})
                row = cursor.fetchone()
        return _row_to_local_admin_user(row) if row else None

    def _derive_totp_secret(self, user_id: str) -> str:
        digest = hmac.new(
            self.settings.session_secret.encode("utf-8"),
            f"totp:{user_id}".encode("utf-8"),
            hashlib.sha1,
        ).digest()
        return base64.b32encode(digest).decode("ascii").rstrip("=")


def _decode_jwt_claims(token: str) -> dict[str, object]:
    parts = token.split(".")
    if len(parts) != 3:
        raise AdminOidcError("Microsoft login failed.")
    payload = parts[1]
    padded = payload + "=" * (-len(payload) % 4)
    try:
        decoded = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
    except ValueError as exc:
        raise AdminOidcError("Microsoft login failed.") from exc
    return json.loads(decoded)


def _row_to_local_admin_user(row: dict[str, object] | None) -> LocalAdminUser | None:
    if row is None:
        return None
    return LocalAdminUser(
        user_id=str(row["user_id"]),
        email=str(row["email"]),
        display_name=str(row.get("display_name") or row["email"]),
        role=str(row["role"]),
        status=str(row["status"]),
        totp_enabled=bool(row["totp_enabled"]),
    )


def _format_timestamp(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)


def _is_expired(value: object) -> bool:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) < datetime.now(timezone.utc)
    return True


def _verify_totp_code(secret: str, code: str) -> bool:
    if len(code) != 6 or not code.isdigit():
        return False
    for offset in (-1, 0, 1):
        if _generate_totp_code(secret, time.time() + (offset * 30)) == code:
            return True
    return False


def _generate_totp_code(secret: str, for_time: float) -> str:
    padding = "=" * (-len(secret) % 8)
    key = base64.b32decode(f"{secret}{padding}".encode("ascii"), casefold=True)
    counter = int(for_time // 30)
    message = counter.to_bytes(8, "big")
    digest = hmac.new(key, message, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = int.from_bytes(digest[offset : offset + 4], "big") & 0x7FFFFFFF
    return str(binary % 1_000_000).zfill(6)
