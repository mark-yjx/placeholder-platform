from dataclasses import dataclass

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.problems import AdminProblemListItem


@dataclass
class FakeProblemListService:
    items: list[AdminProblemListItem]

    def list_problems(self) -> list[AdminProblemListItem]:
        return self.items


def build_client(monkeypatch, items: list[AdminProblemListItem]) -> TestClient:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "correct horse")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "local-admin-secret")
    return TestClient(create_app(problem_list_service=FakeProblemListService(items)))


def issue_token(client: TestClient) -> str:
    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )
    return response.json()["token"]


def test_admin_problems_returns_rows_for_valid_token(monkeypatch) -> None:
    client = build_client(
        monkeypatch,
        [
            AdminProblemListItem(
                problemId="collapse",
                title="Collapse Identical Digits",
                visibility="public",
                updatedAt="2026-03-09T12:00:00Z",
            )
        ],
    )
    token = issue_token(client)

    response = client.get("/admin/problems", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "problemId": "collapse",
            "title": "Collapse Identical Digits",
            "visibility": "public",
            "updatedAt": "2026-03-09T12:00:00Z",
        }
    ]


def test_admin_problems_rejects_missing_token(monkeypatch) -> None:
    client = build_client(monkeypatch, [])

    response = client.get("/admin/problems")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}


def test_admin_problems_rejects_invalid_token(monkeypatch) -> None:
    client = build_client(monkeypatch, [])

    response = client.get(
        "/admin/problems",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin token."}
