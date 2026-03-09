from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import (
    AdminAuthConfigError,
    AdminIdentity,
    create_admin_token,
    load_admin_auth_settings,
    require_admin_identity,
)
from app.models.auth import AdminUserView, LoginRequest, LoginResponse, MeResponse

router = APIRouter(prefix="/admin/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    try:
        settings = load_admin_auth_settings()
    except AdminAuthConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    if payload.email != settings.email or payload.password != settings.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
        )

    user = AdminUserView(email=settings.email)
    token = create_admin_token(email=settings.email, token_secret=settings.token_secret)
    return LoginResponse(token=token, user=user)


@router.get("/me", response_model=MeResponse)
def current_admin(identity: AdminIdentity = Depends(require_admin_identity)) -> MeResponse:
    return MeResponse(user=AdminUserView(email=identity.email))
