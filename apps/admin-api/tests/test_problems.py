from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.problems import AdminProblemDetail, AdminProblemListItem, AdminProblemUpdateRequest


@dataclass
class FakeProblemService:
    items: list[AdminProblemListItem]
    details: dict[str, AdminProblemDetail] = field(default_factory=dict)
    update_calls: list[tuple[str, AdminProblemUpdateRequest]] = field(default_factory=list)

    def list_problems(self) -> list[AdminProblemListItem]:
        return self.items

    def get_problem(self, problem_id: str) -> AdminProblemDetail | None:
        return self.details.get(problem_id)

    def update_problem(
        self, problem_id: str, payload: AdminProblemUpdateRequest
    ) -> AdminProblemDetail | None:
        self.update_calls.append((problem_id, payload))
        current = self.details.get(problem_id)
        if current is None:
            return None

        updated = AdminProblemDetail(
            problemId=problem_id,
            title=payload.title,
            entryFunction=payload.entryFunction,
            language=payload.language,
            timeLimitMs=payload.timeLimitMs,
            memoryLimitKb=payload.memoryLimitKb,
            visibility=payload.visibility,
            statementMarkdown=payload.statementMarkdown,
            starterCode=payload.starterCode,
            updatedAt="2026-03-10T00:00:00Z",
        )
        self.details[problem_id] = updated
        return updated


def build_client(monkeypatch, service: FakeProblemService) -> TestClient:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "correct horse")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "local-admin-secret")
    return TestClient(create_app(problem_list_service=service))


def issue_token(client: TestClient) -> str:
    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )
    return response.json()["token"]


def test_admin_problems_returns_rows_for_valid_token(monkeypatch) -> None:
    service = FakeProblemService(
        items=[
            AdminProblemListItem(
                problemId="collapse",
                title="Collapse Identical Digits",
                visibility="public",
                updatedAt="2026-03-09T12:00:00Z",
            )
        ]
    )
    client = build_client(monkeypatch, service)

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


def test_admin_problem_detail_returns_problem_for_valid_token(monkeypatch) -> None:
    service = FakeProblemService(
        items=[],
        details={
            "collapse": AdminProblemDetail(
                problemId="collapse",
                title="Collapse Identical Digits",
                entryFunction="collapse",
                language="python",
                timeLimitMs=2000,
                memoryLimitKb=65536,
                visibility="public",
                statementMarkdown="# Collapse Identical Digits",
                starterCode="def collapse(number):\n    return number\n",
                updatedAt="2026-03-09T12:00:00Z",
            )
        },
    )
    client = build_client(monkeypatch, service)

    token = issue_token(client)

    response = client.get(
        "/admin/problems/collapse",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["entryFunction"] == "collapse"
    assert response.json()["starterCode"].startswith("def collapse")


def test_admin_problem_detail_rejects_missing_token(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeProblemService(items=[]))

    response = client.get("/admin/problems/collapse")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}


def test_admin_problem_update_persists_for_valid_token(monkeypatch) -> None:
    service = FakeProblemService(
        items=[],
        details={
            "collapse": AdminProblemDetail(
                problemId="collapse",
                title="Collapse Identical Digits",
                entryFunction="collapse",
                language="python",
                timeLimitMs=2000,
                memoryLimitKb=65536,
                visibility="public",
                statementMarkdown="# Collapse Identical Digits",
                starterCode="def collapse(number):\n    return number\n",
                updatedAt="2026-03-09T12:00:00Z",
            )
        },
    )
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    payload = {
        "problemId": "collapse",
        "title": "Collapse Digits",
        "entryFunction": "collapse",
        "language": "python",
        "timeLimitMs": 2500,
        "memoryLimitKb": 131072,
        "visibility": "private",
        "statementMarkdown": "# Collapse Digits\n\nUpdated statement.",
        "starterCode": "def collapse(number):\n    return int(number)\n",
    }

    response = client.put(
        "/admin/problems/collapse",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )

    assert response.status_code == 200
    assert response.json() == {
        "problemId": "collapse",
        "title": "Collapse Digits",
        "entryFunction": "collapse",
        "language": "python",
        "timeLimitMs": 2500,
        "memoryLimitKb": 131072,
        "visibility": "private",
        "statementMarkdown": "# Collapse Digits\n\nUpdated statement.",
        "starterCode": "def collapse(number):\n    return int(number)\n",
        "updatedAt": "2026-03-10T00:00:00Z",
    }
    assert service.update_calls[0][0] == "collapse"
    assert service.update_calls[0][1].entryFunction == "collapse"


def test_admin_problem_update_rejects_invalid_payload(monkeypatch) -> None:
    service = FakeProblemService(items=[], details={})
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    response = client.put(
        "/admin/problems/collapse",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "problemId": "collapse",
            "title": "Collapse Digits",
            "entryFunction": "123 bad",
            "language": "python",
            "timeLimitMs": 2500,
            "memoryLimitKb": 131072,
            "visibility": "public",
            "statementMarkdown": "# Collapse Digits",
            "starterCode": "def solve(number):\n    return number\n",
        },
    )

    assert response.status_code == 422
    assert service.update_calls == []


def test_admin_problem_update_rejects_problem_id_changes(monkeypatch) -> None:
    service = FakeProblemService(items=[], details={})
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    response = client.put(
        "/admin/problems/collapse",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "problemId": "renamed-problem",
            "title": "Collapse Digits",
            "entryFunction": "collapse",
            "language": "python",
            "timeLimitMs": 2500,
            "memoryLimitKb": 131072,
            "visibility": "public",
            "statementMarkdown": "# Collapse Digits",
            "starterCode": "def collapse(number):\n    return number\n",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Problem ID is read-only for this MVP."}
    assert service.update_calls == []


def test_admin_problems_rejects_missing_token(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeProblemService(items=[]))

    response = client.get("/admin/problems")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}


def test_admin_problems_rejects_invalid_token(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeProblemService(items=[]))

    response = client.get(
        "/admin/problems",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin token."}
