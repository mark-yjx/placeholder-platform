from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.tests import (
    AdminProblemTestCase,
    AdminProblemTestsDetail,
    AdminProblemTestsUpdateRequest,
)
from .support import AUTHENTICATED_ADMIN_TOKEN, FakeProtectedAdminAuthService


@dataclass
class FakeProblemTestService:
    details: dict[str, AdminProblemTestsDetail] = field(default_factory=dict)
    update_calls: list[tuple[str, AdminProblemTestsUpdateRequest]] = field(default_factory=list)

    def get_tests(self, problem_id: str) -> AdminProblemTestsDetail | None:
        return self.details.get(problem_id)

    def update_tests(
        self, problem_id: str, payload: AdminProblemTestsUpdateRequest
    ) -> AdminProblemTestsDetail | None:
        self.update_calls.append((problem_id, payload))
        current = self.details.get(problem_id)
        if current is None:
            return None

        updated = AdminProblemTestsDetail(
            problemId=problem_id,
            publicTests=payload.publicTests,
            hiddenTests=payload.hiddenTests,
        )
        self.details[problem_id] = updated
        return updated


def build_client(monkeypatch, service: FakeProblemTestService) -> TestClient:
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "local-admin-session-secret")
    monkeypatch.setenv("ADMIN_MICROSOFT_CLIENT_ID", "local-microsoft-client")
    return TestClient(
        create_app(
            problem_test_service=service,
            auth_service=FakeProtectedAdminAuthService(),
        )
    )


def test_admin_problem_tests_returns_separate_public_and_hidden_rows(monkeypatch) -> None:
    service = FakeProblemTestService(
        details={
            "collapse": AdminProblemTestsDetail(
                problemId="collapse",
                publicTests=[
                    AdminProblemTestCase(input="0", output="0"),
                    AdminProblemTestCase(input="111", output="1"),
                ],
                hiddenTests=[
                    AdminProblemTestCase(input="111122223333", output="123"),
                ],
            )
        }
    )
    client = build_client(monkeypatch, service)
    token = AUTHENTICATED_ADMIN_TOKEN

    response = client.get(
        "/admin/problems/collapse/tests",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "problemId": "collapse",
        "publicTests": [
            {"input": "0", "output": "0"},
            {"input": "111", "output": "1"},
        ],
        "hiddenTests": [
            {"input": "111122223333", "output": "123"},
        ],
    }


def test_admin_problem_tests_rejects_missing_token(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeProblemTestService())

    response = client.get("/admin/problems/collapse/tests")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}


def test_admin_problem_tests_update_persists_for_valid_token(monkeypatch) -> None:
    service = FakeProblemTestService(
        details={
            "collapse": AdminProblemTestsDetail(
                problemId="collapse",
                publicTests=[AdminProblemTestCase(input="0", output="0")],
                hiddenTests=[AdminProblemTestCase(input="1111", output="1")],
            )
        }
    )
    client = build_client(monkeypatch, service)
    token = AUTHENTICATED_ADMIN_TOKEN

    response = client.put(
        "/admin/problems/collapse/tests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "publicTests": [
                {"input": "0", "output": "0"},
                {"input": "12321", "output": "12321"},
            ],
            "hiddenTests": [
                {"input": "111122223333", "output": "123"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "problemId": "collapse",
        "publicTests": [
            {"input": "0", "output": "0"},
            {"input": "12321", "output": "12321"},
        ],
        "hiddenTests": [
            {"input": "111122223333", "output": "123"},
        ],
    }
    assert service.update_calls[0][0] == "collapse"
    assert service.update_calls[0][1].hiddenTests[0].input == "111122223333"


def test_admin_problem_tests_update_rejects_invalid_payload(monkeypatch) -> None:
    service = FakeProblemTestService()
    client = build_client(monkeypatch, service)
    token = AUTHENTICATED_ADMIN_TOKEN

    response = client.put(
        "/admin/problems/collapse/tests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "publicTests": [
                {"input": "not-json", "output": "0"},
            ],
            "hiddenTests": [],
        },
    )

    assert response.status_code == 422
    assert service.update_calls == []
