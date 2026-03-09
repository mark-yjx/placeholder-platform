from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.submissions import AdminSubmissionDetail, AdminSubmissionListItem


@dataclass
class FakeSubmissionService:
    items: list[AdminSubmissionListItem]
    details: dict[str, AdminSubmissionDetail] = field(default_factory=dict)

    def list_submissions(self) -> list[AdminSubmissionListItem]:
        return self.items

    def get_submission(self, submission_id: str) -> AdminSubmissionDetail | None:
        return self.details.get(submission_id)


def build_client(monkeypatch, service: FakeSubmissionService) -> TestClient:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "correct horse")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "local-admin-secret")
    return TestClient(create_app(submission_service=service))


def issue_token(client: TestClient) -> str:
    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )
    return response.json()["token"]


def test_admin_submissions_returns_rows_for_valid_token(monkeypatch) -> None:
    service = FakeSubmissionService(
        items=[
            AdminSubmissionListItem(
                submissionId="sub-101",
                ownerUserId="student-1",
                problemId="collapse",
                status="finished",
                verdict="WA",
                timeMs=12,
                memoryKb=None,
                submittedAt="2026-03-09T13:00:00Z",
            ),
            AdminSubmissionListItem(
                submissionId="sub-102",
                ownerUserId="student-2",
                problemId="collapse",
                status="running",
                verdict=None,
                timeMs=None,
                memoryKb=None,
                submittedAt="2026-03-09T13:05:00Z",
            ),
        ]
    )
    client = build_client(monkeypatch, service)
    token = issue_token(client)

    response = client.get("/admin/submissions", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "submissionId": "sub-101",
            "ownerUserId": "student-1",
            "problemId": "collapse",
            "status": "finished",
            "verdict": "WA",
            "timeMs": 12,
            "memoryKb": None,
            "submittedAt": "2026-03-09T13:00:00Z",
        },
        {
            "submissionId": "sub-102",
            "ownerUserId": "student-2",
            "problemId": "collapse",
            "status": "running",
            "verdict": None,
            "timeMs": None,
            "memoryKb": None,
            "submittedAt": "2026-03-09T13:05:00Z",
        },
    ]


def test_admin_submissions_rejects_missing_token(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeSubmissionService(items=[]))

    response = client.get("/admin/submissions")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}


def test_admin_submission_detail_returns_finished_submission(monkeypatch) -> None:
    service = FakeSubmissionService(
        items=[],
        details={
            "sub-101": AdminSubmissionDetail(
                submissionId="sub-101",
                ownerUserId="student-1",
                problemId="collapse",
                status="finished",
                verdict="WA",
                timeMs=12,
                memoryKb=None,
                failureReason=None,
                errorDetail=None,
                submittedAt="2026-03-09T13:00:00Z",
                sourceSnapshot="def collapse(number):\n    return 0\n",
            ),
            "sub-102": AdminSubmissionDetail(
                submissionId="sub-102",
                ownerUserId="student-2",
                problemId="collapse",
                status="failed",
                verdict=None,
                timeMs=None,
                memoryKb=None,
                failureReason="Worker crashed before judging.",
                errorDetail=None,
                submittedAt="2026-03-09T13:05:00Z",
                sourceSnapshot="def collapse(number):\n    raise RuntimeError('boom')\n",
            ),
        },
    )
    client = build_client(monkeypatch, service)
    token = issue_token(client)

    finished_response = client.get(
        "/admin/submissions/sub-101",
        headers={"Authorization": f"Bearer {token}"},
    )
    failed_response = client.get(
        "/admin/submissions/sub-102",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert finished_response.status_code == 200
    assert finished_response.json() == {
        "submissionId": "sub-101",
        "ownerUserId": "student-1",
        "problemId": "collapse",
        "status": "finished",
        "verdict": "WA",
        "timeMs": 12,
        "memoryKb": None,
        "failureReason": None,
        "errorDetail": None,
        "submittedAt": "2026-03-09T13:00:00Z",
        "sourceSnapshot": "def collapse(number):\n    return 0\n",
    }

    assert failed_response.status_code == 200
    assert failed_response.json()["status"] == "failed"
    assert failed_response.json()["failureReason"] == "Worker crashed before judging."
    assert failed_response.json()["verdict"] is None
    assert failed_response.json()["timeMs"] is None
    assert failed_response.json()["memoryKb"] is None
    assert failed_response.json()["errorDetail"] is None


def test_admin_submission_detail_returns_not_found(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeSubmissionService(items=[], details={}))
    token = issue_token(client)

    response = client.get(
        "/admin/submissions/unknown-submission",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Admin submission was not found."}
