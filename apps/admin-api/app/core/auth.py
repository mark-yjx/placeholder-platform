from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


class AdminAuthConfigError(RuntimeError):
    """Raised when required admin auth configuration is missing."""


@dataclass(frozen=True)
class AdminAuthSettings:
    email: str
    password: str
    token_secret: str


@dataclass(frozen=True)
class AdminIdentity:
    email: str
    user_id: str | None = None
    role: str = "admin"


def load_admin_auth_settings() -> AdminAuthSettings:
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    token_secret = os.getenv("ADMIN_TOKEN_SECRET")

    if not email or not password or not token_secret:
        raise AdminAuthConfigError(
            "Admin auth is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, "
            "and ADMIN_TOKEN_SECRET."
        )

    return AdminAuthSettings(
        email=email,
        password=password,
        token_secret=token_secret,
    )


def _encode_segment(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode_segment(raw: str) -> bytes:
    padded = raw + "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def create_admin_token(
    email: str,
    token_secret: str,
    user_id: str | None = None,
    expires_in_seconds: int = 3600,
) -> str:
    claims = {
        "email": email,
        "role": "admin",
        "exp": int(time.time()) + expires_in_seconds,
    }
    if user_id:
        claims["userId"] = user_id
    payload = _encode_segment(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _encode_segment(
        hmac.new(token_secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    )
    return f"{payload}.{signature}"


def verify_admin_token(token: str, token_secret: str) -> AdminIdentity | None:
    try:
        payload, signature = token.split(".", 1)
    except ValueError:
        return None

    expected_signature = _encode_segment(
        hmac.new(token_secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        claims = json.loads(_decode_segment(payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None

    if claims.get("role") != "admin":
        return None
    if not isinstance(claims.get("exp"), int) or claims["exp"] < int(time.time()):
        return None
    if not isinstance(claims.get("email"), str) or not claims["email"]:
        return None

    user_id = claims.get("userId")
    if user_id is not None and not isinstance(user_id, str):
        return None

    return AdminIdentity(email=claims["email"], user_id=user_id)


bearer_scheme = HTTPBearer(auto_error=False)


def require_admin_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AdminIdentity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin bearer token.",
        )

    try:
        settings = load_admin_auth_settings()
    except AdminAuthConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    identity = verify_admin_token(credentials.credentials, settings.token_secret)
    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token.",
        )

    return identity
