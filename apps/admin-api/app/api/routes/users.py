from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import AdminIdentity, require_admin_identity
from app.models.users import (
    AdminUserCreateRequest,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserPasswordRequest,
    AdminUserUpdateRequest,
)
from app.services import AdminUserService, UserAlreadyExistsError, UserOperationValidationError

router = APIRouter(prefix="/admin/users", tags=["users"])


def _get_user_service(request: Request) -> AdminUserService:
    return request.app.state.user_service


@router.get("", response_model=list[AdminUserListItem])
def list_admin_users(
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> list[AdminUserListItem]:
    try:
        return service.list_users()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin users list is unavailable.",
        ) from exc


@router.get("/{user_id}", response_model=AdminUserDetail)
def get_admin_user(
    user_id: str,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> AdminUserDetail:
    try:
        user = service.get_user(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin user detail is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user was not found.",
        )

    return user


@router.post("", response_model=AdminUserDetail, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreateRequest,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> AdminUserDetail:
    try:
        return service.create_user(payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except UserOperationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin user creation is unavailable.",
        ) from exc


@router.put("/{user_id}", response_model=AdminUserDetail)
def update_admin_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> AdminUserDetail:
    try:
        user = service.update_user(user_id, payload)
    except UserOperationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin user update is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user was not found.",
        )

    return user


@router.post("/{user_id}/enable", response_model=AdminUserDetail)
def enable_admin_user(
    user_id: str,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> AdminUserDetail:
    try:
        user = service.set_user_status(user_id, "active")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin user status update is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user was not found.",
        )

    return user


@router.post("/{user_id}/disable", response_model=AdminUserDetail)
def disable_admin_user(
    user_id: str,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> AdminUserDetail:
    try:
        user = service.set_user_status(user_id, "disabled")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin user status update is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user was not found.",
        )

    return user


@router.post("/{user_id}/password", response_model=AdminUserDetail)
def set_admin_user_password(
    user_id: str,
    payload: AdminUserPasswordRequest,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminUserService = Depends(_get_user_service),
) -> AdminUserDetail:
    try:
        user = service.set_user_password(user_id, payload.password)
    except UserOperationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin user password update is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user was not found.",
        )

    return user
