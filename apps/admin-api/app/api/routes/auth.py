from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import (
    AdminAuthConfigError,
    AdminIdentity,
    create_admin_token,
    load_admin_auth_settings,
    require_admin_identity,
)
from app.models.auth import AdminUserView, LoginRequest, LoginResponse, MeResponse
from app.services import AdminUserService

router = APIRouter(prefix="/admin/auth", tags=["auth"])


def _get_user_service(request: Request) -> AdminUserService:
    return request.app.state.user_service


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    user_service: AdminUserService = Depends(_get_user_service),
) -> LoginResponse:
    try:
        settings = load_admin_auth_settings()
    except AdminAuthConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    try:
        managed_user = user_service.authenticate_admin(payload.email, payload.password)
    except Exception:
        managed_user = None

    if managed_user is not None:
        token = create_admin_token(
            email=managed_user.email,
            user_id=managed_user.userId,
            token_secret=settings.token_secret,
        )
        return LoginResponse(
            token=token,
            user=AdminUserView(
                userId=managed_user.userId,
                email=managed_user.email,
            ),
        )

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
    return MeResponse(user=AdminUserView(userId=identity.user_id, email=identity.email))
