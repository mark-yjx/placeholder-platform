from dataclasses import dataclass

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.analytics import AdminAnalyticsOverview
from .support import AUTHENTICATED_ADMIN_TOKEN, FakeProtectedAdminAuthService


@dataclass
class FakeAnalyticsService:
    overview: AdminAnalyticsOverview

    def get_overview(self) -> AdminAnalyticsOverview:
        return self.overview


def build_client(monkeypatch, service: FakeAnalyticsService) -> TestClient:
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "local-admin-session-secret")
    monkeypatch.setenv("ADMIN_MICROSOFT_CLIENT_ID", "local-microsoft-client")
    return TestClient(
        create_app(
            analytics_service=service,
            auth_service=FakeProtectedAdminAuthService(),
        )
    )


def test_admin_analytics_overview_returns_platform_aggregates(monkeypatch) -> None:
    client = build_client(
        monkeypatch,
        FakeAnalyticsService(
            overview=AdminAnalyticsOverview(
                totalUsers=42,
                activeUsers=11,
                activeWindowDays=30,
                totalSubmissions=140,
                totalAcceptedSubmissions=76,
                uniqueProblemSolves=29,
            )
        ),
    )

    response = client.get(
        "/admin/analytics/overview",
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "totalUsers": 42,
        "activeUsers": 11,
        "activeWindowDays": 30,
        "totalSubmissions": 140,
        "totalAcceptedSubmissions": 76,
        "uniqueProblemSolves": 29,
    }


def test_admin_analytics_overview_rejects_missing_token(monkeypatch) -> None:
    client = build_client(
        monkeypatch,
        FakeAnalyticsService(
            overview=AdminAnalyticsOverview(
                totalUsers=0,
                activeUsers=0,
                activeWindowDays=30,
                totalSubmissions=0,
                totalAcceptedSubmissions=0,
                uniqueProblemSolves=0,
            )
        ),
    )

    response = client.get("/admin/analytics/overview")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}
