from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import AdminIdentity, require_admin_identity
from app.models.analytics import AdminAnalyticsOverview
from app.services.analytics import AdminAnalyticsService

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


def _get_analytics_service(request: Request) -> AdminAnalyticsService:
    return request.app.state.analytics_service


@router.get("/overview", response_model=AdminAnalyticsOverview)
def get_admin_analytics_overview(
    _: AdminIdentity = Depends(require_admin_identity),
    service: AdminAnalyticsService = Depends(_get_analytics_service),
) -> AdminAnalyticsOverview:
    try:
        return service.get_overview()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin analytics overview is unavailable.",
        ) from exc
