import json
from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.problems import (
    AdminProblemCreateRequest,
    AdminProblemDetail,
    AdminProblemListItem,
    AdminProblemPreview,
    AdminProblemUpdateRequest,
)
from app.services.problems import (
    ProblemAlreadyExistsError,
    ProblemNotReadyError,
    PsycopgProblemListService,
)


@dataclass
class FakeProblemService:
    items: list[AdminProblemListItem]
    details: dict[str, AdminProblemDetail] = field(default_factory=dict)
    previews: dict[str, AdminProblemPreview] = field(default_factory=dict)
    create_calls: list[AdminProblemCreateRequest] = field(default_factory=list)
    publish_calls: list[str] = field(default_factory=list)
    update_calls: list[tuple[str, AdminProblemUpdateRequest]] = field(default_factory=list)

    def list_problems(self) -> list[AdminProblemListItem]:
        return self.items

    def create_problem(self, payload: AdminProblemCreateRequest) -> AdminProblemDetail:
        self.create_calls.append(payload)
        if payload.problemId in self.details:
            raise ProblemAlreadyExistsError("Problem ID already exists.")

        created = AdminProblemDetail(
            problemId=payload.problemId,
            title=payload.title,
            entryFunction=payload.entryFunction,
            language=payload.language,
            timeLimitMs=payload.timeLimitMs,
            memoryLimitKb=payload.memoryLimitKb,
            visibility="draft",
            statementMarkdown=f"# {payload.title}\n\nProblem statement not written yet.\n",
            starterCode=(
                f"def {payload.entryFunction}(number: int) -> int:\n"
                '    """\n'
                "    Write your solution here.\n"
                '    """\n'
                "    pass\n"
            ),
            updatedAt="2026-03-10T00:00:00Z",
        )
        self.details[payload.problemId] = created
        self.items.append(
            AdminProblemListItem(
                problemId=created.problemId,
                title=created.title,
                visibility=created.visibility,
                updatedAt=created.updatedAt,
            )
        )
        return created

    def get_problem(self, problem_id: str) -> AdminProblemDetail | None:
        return self.details.get(problem_id)

    def get_problem_preview(self, problem_id: str) -> AdminProblemPreview | None:
        return self.previews.get(problem_id)

    def publish_problem(self, problem_id: str) -> AdminProblemDetail | None:
        self.publish_calls.append(problem_id)
        if problem_id == "not-ready":
            raise ProblemNotReadyError(["publicTests", "hiddenTests"])

        current = self.details.get(problem_id)
        if current is None:
            return None

        published = AdminProblemDetail(
            problemId=current.problemId,
            title=current.title,
            entryFunction=current.entryFunction,
            language=current.language,
            timeLimitMs=current.timeLimitMs,
            memoryLimitKb=current.memoryLimitKb,
            visibility="published",
            statementMarkdown=current.statementMarkdown,
            starterCode=current.starterCode,
            updatedAt="2026-03-10T12:00:00Z",
        )
        self.details[problem_id] = published
        return published

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


def test_admin_problem_preview_returns_student_visible_fields(monkeypatch) -> None:
    service = FakeProblemService(
        items=[],
        previews={
            "collapse": AdminProblemPreview(
                problemId="collapse",
                title="Collapse Identical Digits",
                statementMarkdown="# Collapse Identical Digits",
                examples=[{"input": 111, "output": 1}],
                publicTests=[{"input": 12321, "output": 12321}],
            )
        },
    )
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    response = client.get(
        "/admin/problems/collapse/preview",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "problemId": "collapse",
        "title": "Collapse Identical Digits",
        "statementMarkdown": "# Collapse Identical Digits",
        "examples": [{"input": 111, "output": 1}],
        "publicTests": [{"input": 12321, "output": 12321}],
    }


def test_admin_problem_publish_returns_published_problem(monkeypatch) -> None:
    service = FakeProblemService(
        items=[],
        details={
            "collapse": AdminProblemDetail(
                problemId="collapse",
                title="Collapse Identical Digits",
                entryFunction="collapse",
                language="python",
                timeLimitMs=2000,
                memoryLimitKb=262144,
                visibility="draft",
                statementMarkdown="# Collapse Identical Digits",
                starterCode="def collapse(number):\n    return number\n",
                updatedAt="2026-03-10T00:00:00Z",
            )
        },
    )
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    response = client.post(
        "/admin/problems/collapse/publish",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["visibility"] == "published"
    assert service.publish_calls == ["collapse"]


def test_admin_problem_publish_returns_problem_not_ready_shape(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeProblemService(items=[]))

    token = issue_token(client)
    response = client.post(
        "/admin/problems/not-ready/publish",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": "problem_not_ready",
        "missing": ["publicTests", "hiddenTests"],
    }


def test_admin_problem_create_returns_created_problem_for_valid_token(monkeypatch) -> None:
    service = FakeProblemService(items=[], details={})
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    payload = {
        "problemId": "collapse",
        "title": "Collapse Identical Digits",
        "entryFunction": "collapse",
        "language": "python",
        "timeLimitMs": 2000,
        "memoryLimitKb": 262144,
    }

    response = client.post(
        "/admin/problems",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )

    assert response.status_code == 201
    assert response.json() == {
        "problemId": "collapse",
        "title": "Collapse Identical Digits",
        "entryFunction": "collapse",
        "language": "python",
        "timeLimitMs": 2000,
        "memoryLimitKb": 262144,
        "visibility": "draft",
        "statementMarkdown": "# Collapse Identical Digits\n\nProblem statement not written yet.\n",
        "starterCode": (
            "def collapse(number: int) -> int:\n"
            '    """\n'
            "    Write your solution here.\n"
            '    """\n'
            "    pass\n"
        ),
        "updatedAt": "2026-03-10T00:00:00Z",
    }
    assert service.create_calls[0].problemId == "collapse"


def test_admin_problem_create_rejects_duplicate_problem_id(monkeypatch) -> None:
    service = FakeProblemService(
        items=[],
        details={
            "collapse": AdminProblemDetail(
                problemId="collapse",
                title="Collapse Identical Digits",
                entryFunction="collapse",
                language="python",
                timeLimitMs=2000,
                memoryLimitKb=262144,
                visibility="draft",
                statementMarkdown="# Collapse Identical Digits\n\nProblem statement not written yet.\n",
                starterCode="def collapse(number: int) -> int:\n    pass\n",
                updatedAt="2026-03-10T00:00:00Z",
            )
        },
    )
    client = build_client(monkeypatch, service)

    token = issue_token(client)
    response = client.post(
        "/admin/problems",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "problemId": "collapse",
            "title": "Collapse Identical Digits",
            "entryFunction": "collapse",
            "language": "python",
            "timeLimitMs": 2000,
            "memoryLimitKb": 262144,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Problem ID already exists."}


def test_admin_problem_create_rejects_invalid_problem_id(monkeypatch) -> None:
    client = build_client(monkeypatch, FakeProblemService(items=[]))

    token = issue_token(client)
    response = client.post(
        "/admin/problems",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "problemId": "../bad",
            "title": "Collapse Identical Digits",
            "entryFunction": "collapse",
            "language": "python",
            "timeLimitMs": 2000,
            "memoryLimitKb": 262144,
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == (
        "Value error, problemId must use lowercase letters, numbers, underscores, or hyphens."
    )


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


def test_problem_service_create_problem_generates_initial_files(tmp_path) -> None:
    service = PsycopgProblemListService(
        database_url="postgresql://invalid:invalid@127.0.0.1:1/invalid",
        problems_root=tmp_path,
    )

    created = service.create_problem(
        AdminProblemCreateRequest(
            problemId="collapse",
            title="Collapse Identical Digits",
            entryFunction="collapse",
            language="python",
            timeLimitMs=2000,
            memoryLimitKb=262144,
        )
    )

    problem_dir = tmp_path / "collapse"
    assert created.visibility == "draft"
    assert problem_dir.is_dir()
    assert json.loads((problem_dir / "manifest.json").read_text(encoding="utf-8")) == {
        "problemId": "collapse",
        "title": "Collapse Identical Digits",
        "language": "python",
        "entryFunction": "collapse",
        "timeLimitMs": 2000,
        "memoryLimitKb": 262144,
        "visibility": "draft",
        "examples": [],
        "publicTests": [],
    }
    assert (problem_dir / "statement.md").read_text(encoding="utf-8") == (
        "# Collapse Identical Digits\n\nProblem statement not written yet.\n"
    )
    assert (problem_dir / "starter.py").read_text(encoding="utf-8") == (
        "def collapse(number: int) -> int:\n"
        '    """\n'
        "    Write your solution here.\n"
        '    """\n'
        "    pass\n"
    )
    assert (problem_dir / "hidden.json").read_text(encoding="utf-8") == "[]\n"


def test_problem_service_reads_and_updates_file_backed_problem(tmp_path) -> None:
    service = PsycopgProblemListService(
        database_url="postgresql://invalid:invalid@127.0.0.1:1/invalid",
        problems_root=tmp_path,
    )
    service.create_problem(
        AdminProblemCreateRequest(
            problemId="collapse",
            title="Collapse Identical Digits",
            entryFunction="collapse",
            language="python",
            timeLimitMs=2000,
            memoryLimitKb=262144,
        )
    )
    manifest_path = tmp_path / "collapse" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["examples"] = [{"input": 111, "output": 1}]
    manifest["publicTests"] = [{"input": 0, "output": 0}]
    manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")
    (tmp_path / "collapse" / "hidden.json").write_text(
        '[{"input": 9999, "output": 9}]\n',
        encoding="utf-8",
    )

    loaded = service.get_problem("collapse")
    assert loaded is not None
    assert loaded.visibility == "draft"

    updated = service.update_problem(
        "collapse",
        AdminProblemUpdateRequest(
            problemId="collapse",
            title="Collapse Digits",
            entryFunction="collapse",
            language="python",
            timeLimitMs=2500,
            memoryLimitKb=131072,
            visibility="draft",
            statementMarkdown="# Collapse Digits\n\nUpdated statement.\n",
            starterCode="def collapse(number: int) -> int:\n    return number\n",
        ),
    )

    assert updated is not None
    assert updated.title == "Collapse Digits"
    assert json.loads((tmp_path / "collapse" / "manifest.json").read_text(encoding="utf-8"))[
        "title"
    ] == "Collapse Digits"
    assert json.loads((tmp_path / "collapse" / "manifest.json").read_text(encoding="utf-8"))[
        "publicTests"
    ] == [{"input": 0, "output": 0}]
    assert (tmp_path / "collapse" / "statement.md").read_text(encoding="utf-8") == (
        "# Collapse Digits\n\nUpdated statement."
    )


def test_problem_service_publish_problem_marks_manifest_published(tmp_path) -> None:
    service = PsycopgProblemListService(
        database_url="postgresql://invalid:invalid@127.0.0.1:1/invalid",
        problems_root=tmp_path,
    )
    service.create_problem(
        AdminProblemCreateRequest(
            problemId="collapse",
            title="Collapse Identical Digits",
            entryFunction="collapse",
            language="python",
            timeLimitMs=2000,
            memoryLimitKb=262144,
        )
    )
    manifest_path = tmp_path / "collapse" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["examples"] = [{"input": 111, "output": 1}]
    manifest["publicTests"] = [{"input": 0, "output": 0}]
    manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")
    (tmp_path / "collapse" / "hidden.json").write_text(
        '[{"input": 9999, "output": 9}]\n',
        encoding="utf-8",
    )

    published = service.publish_problem("collapse")

    assert published is not None
    assert published.visibility == "published"
    assert json.loads(manifest_path.read_text(encoding="utf-8"))["visibility"] == "published"


def test_problem_service_publish_problem_rejects_missing_readiness_requirements(tmp_path) -> None:
    service = PsycopgProblemListService(
        database_url="postgresql://invalid:invalid@127.0.0.1:1/invalid",
        problems_root=tmp_path,
    )
    service.create_problem(
        AdminProblemCreateRequest(
            problemId="collapse",
            title="Collapse Identical Digits",
            entryFunction="collapse",
            language="python",
            timeLimitMs=2000,
            memoryLimitKb=262144,
        )
    )

    try:
        service.publish_problem("collapse")
    except ProblemNotReadyError as exc:
        assert exc.missing == ["publicTests", "hiddenTests"]
    else:
        raise AssertionError("Expected publish readiness validation to fail.")


def test_problem_service_reads_student_preview_without_hidden_tests(tmp_path) -> None:
    service = PsycopgProblemListService(
        database_url="postgresql://invalid:invalid@127.0.0.1:1/invalid",
        problems_root=tmp_path,
    )
    service.create_problem(
        AdminProblemCreateRequest(
            problemId="collapse",
            title="Collapse Identical Digits",
            entryFunction="collapse",
            language="python",
            timeLimitMs=2000,
            memoryLimitKb=262144,
        )
    )
    manifest_path = tmp_path / "collapse" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["examples"] = [{"input": 111, "output": 1}]
    manifest["publicTests"] = [{"input": 0, "output": 0}]
    manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")
    (tmp_path / "collapse" / "hidden.json").write_text(
        '[{"input": 9999, "output": 9}]\n',
        encoding="utf-8",
    )

    preview = service.get_problem_preview("collapse")

    assert preview is not None
    assert [item.model_dump() for item in preview.examples] == [{"input": 111, "output": 1}]
    assert [item.model_dump() for item in preview.publicTests] == [{"input": 0, "output": 0}]
    assert "hiddenTests" not in preview.model_dump()
