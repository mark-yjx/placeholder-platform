from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import AdminIdentity, require_admin_identity
from app.models.submissions import AdminSubmissionDetail, AdminSubmissionListItem
from app.services.submissions import AdminSubmissionService

router = APIRouter(prefix="/admin/submissions", tags=["submissions"])


def _get_submission_service(request: Request) -> AdminSubmissionService:
    return request.app.state.submission_service


@router.get("", response_model=list[AdminSubmissionListItem])
def list_admin_submissions(
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminSubmissionService = Depends(_get_submission_service),
) -> list[AdminSubmissionListItem]:
    try:
        return service.list_submissions()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin submissions list is unavailable.",
        ) from exc


@router.get("/{submission_id}", response_model=AdminSubmissionDetail)
def get_admin_submission(
    submission_id: str,
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminSubmissionService = Depends(_get_submission_service),
) -> AdminSubmissionDetail:
    try:
        submission = service.get_submission(submission_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin submission detail is unavailable.",
        ) from exc

    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin submission was not found.",
        )

    return submission
