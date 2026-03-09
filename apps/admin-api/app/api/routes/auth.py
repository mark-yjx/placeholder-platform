import os
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from app.core.auth import (
    AdminAuthConfigError,
    AdminIdentity,
    require_admin_identity,
)
from app.models.auth import (
    LoginRequest,
    MeResponse,
    SessionResponse,
    TotpEnrollConfirmRequest,
    TotpEnrollInitResponse,
    TotpVerifyRequest,
)
from app.services import AdminOidcError, AdminAuthService, TotpVerificationError

router = APIRouter(prefix="/admin/auth", tags=["auth"])


def _get_auth_service(request: Request) -> AdminAuthService:
    return request.app.state.auth_service


def _build_admin_web_redirect(path: str, *, fragment: str | None = None) -> str:
    base = os.getenv("ADMIN_WEB_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
    target = f"{base}{path}"
    if fragment:
        return f"{target}#{fragment}"
    return target


def _build_admin_web_error_redirect(detail: str) -> RedirectResponse:
    safe_message = quote(detail)
    return RedirectResponse(
        url=f"{_build_admin_web_redirect('/login')}?error={safe_message}",
        status_code=status.HTTP_302_FOUND,
    )


@router.post("/login", response_model=SessionResponse)
def login_with_password(
    payload: LoginRequest,
    service: AdminAuthService = Depends(_get_auth_service),
) -> SessionResponse:
    try:
        session = service.login_with_password(payload.email, payload.password)
    except AdminAuthConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc) or "Invalid email or password.",
        ) from exc

    if session.user is None or session.token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    return SessionResponse(
        state=session.state,
        token=session.token,
        user=session.user,
        pendingExpiresAt=session.pending_expires_at,
    )


@router.get("/login/microsoft")
def login_with_microsoft(
    service: AdminAuthService = Depends(_get_auth_service),
) -> RedirectResponse:
    try:
        _, auth_url = service.create_oidc_flow()
    except AdminAuthConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


@router.get("/callback/microsoft")
def microsoft_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    service: AdminAuthService = Depends(_get_auth_service),
) -> RedirectResponse:
    if error:
        return _build_admin_web_error_redirect("Microsoft login failed.")
    if not code or not state:
        return _build_admin_web_error_redirect("Microsoft callback is invalid.")

    try:
        result = service.complete_oidc_callback(provider="microsoft", code=code, flow_token=state)
    except (AdminAuthConfigError, AdminOidcError, ValueError) as exc:
        return _build_admin_web_error_redirect(str(exc) or "Microsoft login failed.")

    fragment = f"token={quote(result.token or '')}&state={quote(result.state)}"
    return RedirectResponse(
        url=_build_admin_web_redirect("/auth/callback", fragment=fragment),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/me", response_model=MeResponse)
def current_admin(
    request: Request,
    service: AdminAuthService = Depends(_get_auth_service),
) -> MeResponse:
    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else None

    session = service.get_session_state(token)
    return MeResponse(
        state=session.state,
        user=session.user,
        pendingExpiresAt=session.pending_expires_at,
    )


@router.post("/totp/verify", response_model=SessionResponse)
def verify_admin_totp(
    payload: TotpVerifyRequest,
    request: Request,
    service: AdminAuthService = Depends(_get_auth_service),
) -> SessionResponse:
    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pending admin verification is missing or expired.",
        )

    try:
        session = service.verify_pending_totp(token, payload.code)
    except TotpVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if session.user is None or session.token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pending admin verification is missing or expired.",
        )

    return SessionResponse(state="authenticated_admin", token=session.token, user=session.user)


@router.post("/totp/enroll/init", response_model=TotpEnrollInitResponse)
def init_totp_enrollment(
    request: Request,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminAuthService = Depends(_get_auth_service),
) -> TotpEnrollInitResponse:
    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin bearer token.",
        )

    try:
        enrollment = service.init_totp_enrollment(token)
    except TotpVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return TotpEnrollInitResponse(
        secret=enrollment.secret,
        otpauthUri=enrollment.otpauth_uri,
        issuer=enrollment.issuer,
        accountName=enrollment.account_name,
    )


@router.post("/totp/enroll/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_totp_enrollment(
    payload: TotpEnrollConfirmRequest,
    request: Request,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminAuthService = Depends(_get_auth_service),
) -> Response:
    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin bearer token.",
        )

    try:
        service.confirm_totp_enrollment(token, payload.code)
    except TotpVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_admin(
    request: Request,
    service: AdminAuthService = Depends(_get_auth_service),
) -> Response:
    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else None
    service.logout(token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
