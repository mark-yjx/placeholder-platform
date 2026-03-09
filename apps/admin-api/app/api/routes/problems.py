from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import AdminIdentity, require_admin_identity
from app.models.problems import AdminProblemListItem
from app.services.problems import AdminProblemListService

router = APIRouter(prefix="/admin/problems", tags=["problems"])


def _get_problem_list_service(request: Request) -> AdminProblemListService:
    return request.app.state.problem_list_service


@router.get("", response_model=list[AdminProblemListItem])
def list_admin_problems(
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminProblemListService = Depends(_get_problem_list_service),
) -> list[AdminProblemListItem]:
    try:
        return service.list_problems()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin problems list is unavailable.",
        ) from exc
