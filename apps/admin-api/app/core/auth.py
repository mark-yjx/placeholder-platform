from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Literal

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SessionTokenState = Literal["pending_tfa", "authenticated_admin"]


class AdminAuthConfigError(RuntimeError):
    """Raised when required admin auth configuration is missing."""


@dataclass(frozen=True)
class AdminAuthSettings:
    session_secret: str
    web_base_url: str
    microsoft_client_id: str
    microsoft_client_secret: str | None
    microsoft_redirect_uri: str
    microsoft_tenant_id: str
    microsoft_oidc_mode: str
    microsoft_mock_email: str
    microsoft_mock_subject: str
    totp_issuer: str
    session_ttl_seconds: int
    pending_tfa_ttl_seconds: int


@dataclass(frozen=True)
class AdminIdentity:
    email: str
    user_id: str
    role: str = "admin"
    totp_enabled: bool = False


@dataclass(frozen=True)
class AdminSessionToken:
    session_id: str
    state: SessionTokenState
    email: str
    user_id: str
    exp: int


@dataclass(frozen=True)
class OidcFlowState:
    state: str
    nonce: str
    code_verifier: str
    exp: int


def load_admin_auth_settings() -> AdminAuthSettings:
    session_secret = os.getenv("ADMIN_SESSION_SECRET") or os.getenv("ADMIN_TOKEN_SECRET")
    web_base_url = os.getenv("ADMIN_WEB_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
    microsoft_client_id = os.getenv("ADMIN_MICROSOFT_CLIENT_ID", "local-microsoft-client")
    microsoft_client_secret = os.getenv("ADMIN_MICROSOFT_CLIENT_SECRET")
    microsoft_redirect_uri = os.getenv(
        "ADMIN_MICROSOFT_REDIRECT_URI",
        "http://127.0.0.1:8200/admin/auth/callback/microsoft",
    )
    microsoft_tenant_id = os.getenv("ADMIN_MICROSOFT_TENANT_ID", "common")
    microsoft_oidc_mode = os.getenv("ADMIN_MICROSOFT_OIDC_MODE", "mock").strip().lower()
    microsoft_mock_email = os.getenv("ADMIN_MICROSOFT_MOCK_EMAIL", "admin@example.com")
    microsoft_mock_subject = os.getenv(
        "ADMIN_MICROSOFT_MOCK_SUBJECT",
        "microsoft-mock-admin-subject",
    )
    totp_issuer = os.getenv("ADMIN_TOTP_ISSUER", "Placeholder Admin")

    if not session_secret:
        raise AdminAuthConfigError(
            "Admin auth is not configured. Set ADMIN_SESSION_SECRET (or ADMIN_TOKEN_SECRET)."
        )
    if not microsoft_client_id:
        raise AdminAuthConfigError(
            "Admin auth is not configured. Set ADMIN_MICROSOFT_CLIENT_ID."
        )
    if microsoft_oidc_mode not in {"mock", "live"}:
        raise AdminAuthConfigError(
            "Admin auth is not configured. ADMIN_MICROSOFT_OIDC_MODE must be 'mock' or 'live'."
        )
    if microsoft_oidc_mode == "live" and not microsoft_client_secret:
        raise AdminAuthConfigError(
            "Admin auth is not configured. Set ADMIN_MICROSOFT_CLIENT_SECRET for live OIDC."
        )

    return AdminAuthSettings(
        session_secret=session_secret,
        web_base_url=web_base_url,
        microsoft_client_id=microsoft_client_id,
        microsoft_client_secret=microsoft_client_secret,
        microsoft_redirect_uri=microsoft_redirect_uri,
        microsoft_tenant_id=microsoft_tenant_id,
        microsoft_oidc_mode=microsoft_oidc_mode,
        microsoft_mock_email=microsoft_mock_email,
        microsoft_mock_subject=microsoft_mock_subject,
        totp_issuer=totp_issuer,
        session_ttl_seconds=3600,
        pending_tfa_ttl_seconds=600,
    )


def _encode_segment(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode_segment(raw: str) -> bytes:
    padded = raw + "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _sign_payload(payload: dict[str, Any], secret: str) -> str:
    encoded_payload = _encode_segment(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = _encode_segment(
        hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    )
    return f"{encoded_payload}.{signature}"


def _verify_payload(token: str, secret: str) -> dict[str, Any] | None:
    try:
        payload, signature = token.split(".", 1)
    except ValueError:
        return None

    expected_signature = _encode_segment(
        hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        claims = json.loads(_decode_segment(payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None

    if not isinstance(claims, dict):
        return None
    return claims


def create_session_token(
    *,
    session_id: str,
    state: SessionTokenState,
    email: str,
    user_id: str,
    token_secret: str,
    expires_in_seconds: int,
) -> str:
    claims = {
        "sid": session_id,
        "state": state,
        "email": email,
        "role": "admin",
        "userId": user_id,
        "exp": int(time.time()) + expires_in_seconds,
    }
    return _sign_payload(claims, token_secret)


def verify_session_token(token: str, token_secret: str) -> AdminSessionToken | None:
    claims = _verify_payload(token, token_secret)
    if claims is None:
        return None

    if claims.get("role") != "admin":
        return None
    if claims.get("state") not in {"pending_tfa", "authenticated_admin"}:
        return None
    if not isinstance(claims.get("exp"), int) or claims["exp"] < int(time.time()):
        return None
    if not isinstance(claims.get("sid"), str) or not claims["sid"]:
        return None
    if not isinstance(claims.get("email"), str) or not claims["email"]:
        return None
    if not isinstance(claims.get("userId"), str) or not claims["userId"]:
        return None

    return AdminSessionToken(
        session_id=claims["sid"],
        state=claims["state"],
        email=claims["email"],
        user_id=claims["userId"],
        exp=claims["exp"],
    )


def create_oidc_flow_token(
    *,
    state: str,
    nonce: str,
    code_verifier: str,
    token_secret: str,
    expires_in_seconds: int = 600,
) -> str:
    claims = {
        "type": "oidc_flow",
        "state": state,
        "nonce": nonce,
        "codeVerifier": code_verifier,
        "exp": int(time.time()) + expires_in_seconds,
    }
    return _sign_payload(claims, token_secret)


def verify_oidc_flow_token(token: str, token_secret: str) -> OidcFlowState | None:
    claims = _verify_payload(token, token_secret)
    if claims is None:
        return None
    if claims.get("type") != "oidc_flow":
        return None
    if not isinstance(claims.get("exp"), int) or claims["exp"] < int(time.time()):
        return None
    if not isinstance(claims.get("state"), str) or not claims["state"]:
        return None
    if not isinstance(claims.get("nonce"), str) or not claims["nonce"]:
        return None
    if not isinstance(claims.get("codeVerifier"), str) or not claims["codeVerifier"]:
        return None
    return OidcFlowState(
        state=claims["state"],
        nonce=claims["nonce"],
        code_verifier=claims["codeVerifier"],
        exp=claims["exp"],
    )


def build_pkce_code_challenge(code_verifier: str) -> str:
    return _encode_segment(hashlib.sha256(code_verifier.encode("utf-8")).digest())


bearer_scheme = HTTPBearer(auto_error=False)


def extract_bearer_token(
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


def require_admin_identity(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AdminIdentity:
    token = extract_bearer_token(credentials)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin bearer token.",
        )

    try:
        identity = request.app.state.auth_service.require_authenticated_admin(token)
    except AdminAuthConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc) or "Invalid admin token.",
        ) from exc

    return identity
