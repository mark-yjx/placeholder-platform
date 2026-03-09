from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import AdminIdentity, require_admin_identity
from app.models.tests import AdminProblemTestsDetail, AdminProblemTestsUpdateRequest
from app.services.tests import AdminProblemTestService

router = APIRouter(prefix="/admin/problems/{problem_id}/tests", tags=["tests"])


def _get_problem_test_service(request: Request) -> AdminProblemTestService:
    return request.app.state.problem_test_service


@router.get("", response_model=AdminProblemTestsDetail)
def get_admin_problem_tests(
    problem_id: str,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminProblemTestService = Depends(_get_problem_test_service),
) -> AdminProblemTestsDetail:
    try:
        problem_tests = service.get_tests(problem_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin problem tests are unavailable.",
        ) from exc

    if problem_tests is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin problem was not found.",
        )

    return problem_tests


@router.put("", response_model=AdminProblemTestsDetail)
def update_admin_problem_tests(
    problem_id: str,
    payload: AdminProblemTestsUpdateRequest,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminProblemTestService = Depends(_get_problem_test_service),
) -> AdminProblemTestsDetail:
    try:
        problem_tests = service.update_tests(problem_id, payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin problem tests update is unavailable.",
        ) from exc

    if problem_tests is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin problem was not found.",
        )

    return problem_tests
