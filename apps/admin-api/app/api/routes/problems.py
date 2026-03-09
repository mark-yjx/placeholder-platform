from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import AdminIdentity, require_admin_identity
from app.models.problems import AdminProblemDetail, AdminProblemListItem, AdminProblemUpdateRequest
from app.services.problems import AdminProblemService

router = APIRouter(prefix="/admin/problems", tags=["problems"])


def _get_problem_service(request: Request) -> AdminProblemService:
    return request.app.state.problem_service


@router.get("", response_model=list[AdminProblemListItem])
def list_admin_problems(
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminProblemService = Depends(_get_problem_service),
) -> list[AdminProblemListItem]:
    try:
        return service.list_problems()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin problems list is unavailable.",
        ) from exc


@router.get("/{problem_id}", response_model=AdminProblemDetail)
def get_admin_problem(
    problem_id: str,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminProblemService = Depends(_get_problem_service),
) -> AdminProblemDetail:
    try:
        problem = service.get_problem(problem_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin problem detail is unavailable.",
        ) from exc

    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin problem was not found.",
        )

    return problem


@router.put("/{problem_id}", response_model=AdminProblemDetail)
def update_admin_problem(
    problem_id: str,
    payload: AdminProblemUpdateRequest,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminProblemService = Depends(_get_problem_service),
) -> AdminProblemDetail:
    if payload.problemId != problem_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Problem ID is read-only for this MVP.",
        )

    try:
        problem = service.update_problem(problem_id, payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin problem update is unavailable.",
        ) from exc

    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin problem was not found.",
        )

    return problem
