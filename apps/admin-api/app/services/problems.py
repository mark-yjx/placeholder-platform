from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from shutil import rmtree
from typing import Any, Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.problems import (
    AdminProblemCase,
    AdminProblemCreateRequest,
    AdminProblemDetail,
    AdminProblemListItem,
    AdminProblemPreview,
    AdminProblemUpdateRequest,
)

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"
DEFAULT_PROBLEMS_ROOT = Path(__file__).resolve().parents[4] / "problems"

LIST_ADMIN_PROBLEMS_SQL = """
SELECT
  p.id AS problem_id,
  COALESCE(pv.title, p.title) AS title,
  COALESCE(pva.visibility, pv.publication_state, p.publication_state) AS visibility,
  COALESCE(pv.created_at, p.created_at) AS updated_at
FROM problems p
LEFT JOIN LATERAL (
  SELECT
    id,
    title,
    publication_state,
    created_at
  FROM problem_versions
  WHERE problem_id = p.id
  ORDER BY version_number DESC
  LIMIT 1
) pv ON TRUE
LEFT JOIN problem_version_assets pva
  ON pva.problem_version_id = pv.id
ORDER BY p.id ASC
"""

ADMIN_PROBLEM_DETAIL_SQL = """
SELECT
  p.id AS problem_id,
  pv.id AS version_id,
  pv.version_number AS version_number,
  pv.title AS title,
  pv.statement AS statement_markdown,
  pv.publication_state AS publication_state,
  pv.created_at AS updated_at,
  pva.entry_function AS entry_function,
  pva.language AS language,
  pva.visibility AS visibility,
  pva.time_limit_ms AS time_limit_ms,
  pva.memory_limit_kb AS memory_limit_kb,
  pva.examples AS examples,
  pva.starter_code AS starter_code,
  pva.difficulty AS difficulty,
  pva.tags AS tags,
  pva.manifest_version AS manifest_version,
  pva.author AS author
FROM problems p
JOIN LATERAL (
  SELECT
    id,
    version_number,
    title,
    statement,
    publication_state,
    created_at
  FROM problem_versions
  WHERE problem_id = p.id
  ORDER BY version_number DESC
  LIMIT 1
) pv ON TRUE
LEFT JOIN problem_version_assets pva
  ON pva.problem_version_id = pv.id
WHERE p.id = %(problem_id)s
"""

PROBLEM_VERSION_NUMBER_SQL = """
SELECT COALESCE(MAX(version_number), 0) AS latest_version_number
FROM problem_versions
WHERE problem_id = %(problem_id)s
"""

UPSERT_PROBLEM_SQL = """
INSERT INTO problems (id, title, publication_state)
VALUES (%(problem_id)s, %(title)s, %(publication_state)s)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    publication_state = EXCLUDED.publication_state
"""

INSERT_PROBLEM_VERSION_SQL = """
INSERT INTO problem_versions (
  id,
  problem_id,
  version_number,
  title,
  statement,
  publication_state
)
VALUES (
  %(version_id)s,
  %(problem_id)s,
  %(version_number)s,
  %(title)s,
  %(statement_markdown)s,
  %(publication_state)s
)
"""

INSERT_PROBLEM_VERSION_ASSETS_SQL = """
INSERT INTO problem_version_assets (
  problem_version_id,
  entry_function,
  language,
  visibility,
  time_limit_ms,
  memory_limit_kb,
  difficulty,
  tags,
  manifest_version,
  author,
  examples,
  starter_code,
  content_digest
)
VALUES (
  %(version_id)s,
  %(entry_function)s,
  %(language)s,
  %(visibility)s,
  %(time_limit_ms)s,
  %(memory_limit_kb)s,
  %(difficulty)s,
  %(tags)s,
  %(manifest_version)s,
  %(author)s,
  %(examples)s::jsonb,
  %(starter_code)s,
  %(content_digest)s
)
"""

LIST_PROBLEM_VERSION_TESTS_SQL = """
SELECT
  test_type,
  position,
  input::text AS input_json,
  expected::text AS output_json
FROM problem_version_tests
WHERE problem_version_id = %(version_id)s
ORDER BY
  CASE test_type WHEN 'public' THEN 0 ELSE 1 END ASC,
  position ASC
"""

INSERT_PROBLEM_VERSION_TEST_SQL = """
INSERT INTO problem_version_tests (
  problem_version_id,
  test_type,
  position,
  input,
  expected
)
VALUES (
  %(problem_version_id)s,
  %(test_type)s,
  %(position)s,
  %(input_json)s::jsonb,
  %(output_json)s::jsonb
)
"""

PROBLEM_EXISTS_SQL = """
SELECT 1
FROM problems
WHERE id = %(problem_id)s
LIMIT 1
"""


class AdminProblemListService(Protocol):
    def list_problems(self) -> list[AdminProblemListItem]:
        ...


class AdminProblemService(AdminProblemListService, Protocol):
    def create_problem(self, payload: AdminProblemCreateRequest) -> AdminProblemDetail:
        ...

    def get_problem(self, problem_id: str) -> AdminProblemDetail | None:
        ...

    def get_problem_preview(self, problem_id: str) -> AdminProblemPreview | None:
        ...

    def publish_problem(self, problem_id: str) -> AdminProblemDetail | None:
        ...

    def update_problem(
        self, problem_id: str, payload: AdminProblemUpdateRequest
    ) -> AdminProblemDetail | None:
        ...


class ProblemAlreadyExistsError(ValueError):
    """Raised when a problem create request collides with an existing problem."""


class ProblemOperationValidationError(ValueError):
    """Raised when an admin problem operation violates the current contract."""


class ProblemNotReadyError(ValueError):
    """Raised when a problem cannot be published yet."""

    def __init__(self, missing: list[str]):
        super().__init__("Problem is not ready to publish.")
        self.missing = missing


@dataclass(frozen=True)
class FileProblemSnapshot:
    problemId: str
    title: str
    entryFunction: str
    language: str
    timeLimitMs: int
    memoryLimitKb: int
    visibility: str
    statementMarkdown: str
    starterCode: str
    examples: list[dict[str, Any]]
    publicTests: list[dict[str, Any]]
    hiddenTests: list[dict[str, Any]]
    updatedAt: str


@dataclass(frozen=True)
class PsycopgProblemListService:
    database_url: str
    problems_root: Path = DEFAULT_PROBLEMS_ROOT

    @classmethod
    def from_env(cls) -> "PsycopgProblemListService":
        return cls(
            database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
            problems_root=Path(os.getenv("PROBLEMS_ROOT", str(DEFAULT_PROBLEMS_ROOT))),
        )

    def list_problems(self) -> list[AdminProblemListItem]:
        items_by_id: dict[str, AdminProblemListItem] = {}

        try:
            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(LIST_ADMIN_PROBLEMS_SQL)
                    rows = cursor.fetchall()
        except psycopg.Error:
            rows = []

        for row in rows:
            problem_id = str(row["problem_id"])
            items_by_id[problem_id] = AdminProblemListItem(
                problemId=problem_id,
                title=str(row["title"]),
                # Fallback to publication_state only when a manifest visibility row is absent.
                visibility=str(row["visibility"]),
                updatedAt=_format_timestamp(row["updated_at"]),
            )

        for detail in _list_file_problem_details(self.problems_root):
            items_by_id.setdefault(
                detail.problemId,
                AdminProblemListItem(
                    problemId=detail.problemId,
                    title=detail.title,
                    visibility=detail.visibility,
                    updatedAt=detail.updatedAt,
                ),
            )

        return sorted(items_by_id.values(), key=lambda item: item.problemId)

    def create_problem(self, payload: AdminProblemCreateRequest) -> AdminProblemDetail:
        if self._problem_exists_in_database(payload.problemId):
            raise ProblemAlreadyExistsError("Problem ID already exists.")

        problem_dir = self.problems_root / payload.problemId
        if problem_dir.exists():
            raise ProblemAlreadyExistsError("Problem ID already exists.")

        detail = _build_created_problem_detail(payload)
        problem_dir.mkdir(parents=True, exist_ok=False)
        try:
            _write_problem_files(
                problem_dir,
                detail,
                examples=[],
                public_tests=[],
                include_hidden=True,
            )
        except Exception:
            rmtree(problem_dir, ignore_errors=True)
            raise

        return detail

    def get_problem(self, problem_id: str) -> AdminProblemDetail | None:
        try:
            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(ADMIN_PROBLEM_DETAIL_SQL, {"problem_id": problem_id})
                    row = cursor.fetchone()
        except psycopg.Error:
            row = None

        if row:
            return _row_to_problem_detail(row)

        return _read_file_problem_detail(self.problems_root / problem_id)

    def get_problem_preview(self, problem_id: str) -> AdminProblemPreview | None:
        snapshot = _read_file_problem_snapshot(self.problems_root / problem_id)
        if snapshot is None:
            return None
        return _snapshot_to_problem_preview(snapshot)

    def publish_problem(self, problem_id: str) -> AdminProblemDetail | None:
        problem_dir = self.problems_root / problem_id
        if not problem_dir.is_dir():
            return None

        manifest = _read_problem_manifest(problem_dir)
        if manifest is None:
            raise ProblemOperationValidationError("Problem manifest is unavailable.")

        missing = _collect_publish_missing(problem_dir, manifest)
        if missing:
            raise ProblemNotReadyError(missing)

        manifest["visibility"] = "published"
        _write_manifest(problem_dir / "manifest.json", manifest)
        return _read_file_problem_detail(problem_dir)

    def update_problem(
        self, problem_id: str, payload: AdminProblemUpdateRequest
    ) -> AdminProblemDetail | None:
        try:
            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.transaction():
                    with connection.cursor() as cursor:
                        cursor.execute(ADMIN_PROBLEM_DETAIL_SQL, {"problem_id": problem_id})
                        existing = cursor.fetchone()
                        if existing is None:
                            return self._update_file_problem(problem_id, payload)

                        if payload.visibility not in {"public", "private"}:
                            raise ProblemOperationValidationError(
                                "Only public/private visibility is supported for imported problems."
                            )

                        cursor.execute(PROBLEM_VERSION_NUMBER_SQL, {"problem_id": problem_id})
                        version_row = cursor.fetchone()
                        next_version_number = int(version_row["latest_version_number"]) + 1
                        version_id = f"{problem_id}-v{next_version_number}"

                        publication_state = str(existing["publication_state"])
                        tags = existing["tags"]
                        content_digest = _build_content_digest(payload)
                        params = {
                            "problem_id": problem_id,
                            "version_id": version_id,
                            "version_number": next_version_number,
                            "title": payload.title,
                            "statement_markdown": payload.statementMarkdown,
                            "publication_state": publication_state,
                            "entry_function": payload.entryFunction,
                            "language": payload.language,
                            "visibility": payload.visibility,
                            "time_limit_ms": payload.timeLimitMs,
                            "memory_limit_kb": payload.memoryLimitKb,
                            "difficulty": existing["difficulty"],
                            "tags": json.dumps(tags) if tags is not None else None,
                            "manifest_version": existing["manifest_version"],
                            "author": existing["author"],
                            "examples": json.dumps(
                                [example.model_dump(mode="json") for example in payload.examples]
                            ),
                            "starter_code": payload.starterCode,
                            "content_digest": content_digest,
                        }

                        cursor.execute(UPSERT_PROBLEM_SQL, params)
                        cursor.execute(INSERT_PROBLEM_VERSION_SQL, params)
                        cursor.execute(INSERT_PROBLEM_VERSION_ASSETS_SQL, params)
                        cursor.execute(
                            LIST_PROBLEM_VERSION_TESTS_SQL,
                            {"version_id": existing["version_id"]},
                        )
                        for test_row in cursor.fetchall():
                            cursor.execute(
                                INSERT_PROBLEM_VERSION_TEST_SQL,
                                {
                                    "problem_version_id": version_id,
                                    "test_type": test_row["test_type"],
                                    "position": int(test_row["position"]),
                                    "input_json": test_row["input_json"],
                                    "output_json": test_row["output_json"],
                                },
                            )

                with connection.cursor() as cursor:
                    cursor.execute(ADMIN_PROBLEM_DETAIL_SQL, {"problem_id": problem_id})
                    updated = cursor.fetchone()

            return _row_to_problem_detail(updated) if updated else None
        except psycopg.Error:
            return self._update_file_problem(problem_id, payload)

    def _problem_exists_in_database(self, problem_id: str) -> bool:
        try:
            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(PROBLEM_EXISTS_SQL, {"problem_id": problem_id})
                    return cursor.fetchone() is not None
        except psycopg.Error:
            return False

    def _update_file_problem(
        self, problem_id: str, payload: AdminProblemUpdateRequest
    ) -> AdminProblemDetail | None:
        problem_dir = self.problems_root / problem_id
        if not problem_dir.is_dir():
            return None

        existing_snapshot = _read_file_problem_snapshot(problem_dir)
        if existing_snapshot is None:
            raise ProblemOperationValidationError("Problem files are unavailable for editing.")

        detail = AdminProblemDetail(
            problemId=payload.problemId,
            title=payload.title,
            entryFunction=payload.entryFunction,
            language=payload.language,
            timeLimitMs=payload.timeLimitMs,
            memoryLimitKb=payload.memoryLimitKb,
            visibility=payload.visibility,
            statementMarkdown=payload.statementMarkdown,
            examples=payload.examples,
            starterCode=payload.starterCode,
            updatedAt=_format_timestamp(datetime.now(timezone.utc)),
        )
        _write_problem_files(
            problem_dir,
            detail,
            examples=[example.model_dump(mode="json") for example in payload.examples],
            public_tests=existing_snapshot.publicTests,
            include_hidden=False,
        )
        return _read_file_problem_detail(problem_dir)


def _format_timestamp(value: datetime | str) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)


def _build_created_problem_detail(payload: AdminProblemCreateRequest) -> AdminProblemDetail:
    return AdminProblemDetail(
        problemId=payload.problemId,
        title=payload.title,
        entryFunction=payload.entryFunction,
        language=payload.language,
        timeLimitMs=payload.timeLimitMs,
        memoryLimitKb=payload.memoryLimitKb,
        visibility="draft",
        statementMarkdown=f"# {payload.title}\n\nProblem statement not written yet.\n",
        examples=[],
        starterCode=_build_starter_code(payload.entryFunction),
        updatedAt=_format_timestamp(datetime.now(timezone.utc)),
    )


def _build_starter_code(entry_function: str) -> str:
    return (
        f"def {entry_function}(number: int) -> int:\n"
        '    """\n'
        "    Write your solution here.\n"
        '    """\n'
        "    pass\n"
    )


def _row_to_problem_detail(row: dict | None) -> AdminProblemDetail | None:
    if row is None:
        return None
    if row.get("entry_function") is None:
        raise RuntimeError("Problem metadata is unavailable for admin editing.")

    return AdminProblemDetail(
        problemId=str(row["problem_id"]),
        title=str(row["title"]),
        entryFunction=str(row["entry_function"]),
        language=str(row["language"]),
        timeLimitMs=int(row["time_limit_ms"]),
        memoryLimitKb=int(row["memory_limit_kb"]),
        visibility=str(row["visibility"]),
        statementMarkdown=str(row["statement_markdown"]),
        examples=_normalize_case_list(row.get("examples")),
        starterCode=str(row["starter_code"]),
        updatedAt=_format_timestamp(row["updated_at"]),
    )


def _list_file_problem_details(problems_root: Path) -> list[AdminProblemDetail]:
    if not problems_root.exists():
        return []

    details: list[AdminProblemDetail] = []
    for candidate in sorted(problems_root.iterdir(), key=lambda path: path.name):
        if not candidate.is_dir():
            continue

        detail = _read_file_problem_detail(candidate)
        if detail is not None:
            details.append(detail)

    return details


def _read_file_problem_detail(problem_dir: Path) -> AdminProblemDetail | None:
    snapshot = _read_file_problem_snapshot(problem_dir)
    if snapshot is None:
        return None

    return AdminProblemDetail(
        problemId=snapshot.problemId,
        title=snapshot.title,
        entryFunction=snapshot.entryFunction,
        language=snapshot.language,
        timeLimitMs=snapshot.timeLimitMs,
        memoryLimitKb=snapshot.memoryLimitKb,
        visibility=str(snapshot.visibility),
        statementMarkdown=snapshot.statementMarkdown,
        examples=snapshot.examples,
        starterCode=snapshot.starterCode,
        updatedAt=snapshot.updatedAt,
    )


def _read_file_problem_snapshot(problem_dir: Path) -> FileProblemSnapshot | None:
    manifest_path = problem_dir / "manifest.json"
    statement_path = problem_dir / "statement.md"
    starter_path = problem_dir / "starter.py"
    hidden_path = problem_dir / "hidden.json"

    if not all(path.exists() for path in (manifest_path, statement_path, starter_path, hidden_path)):
        return None

    manifest = _read_problem_manifest(problem_dir)
    if manifest is None:
        return None

    hidden_tests = _read_hidden_tests(problem_dir)
    if hidden_tests is None:
        return None

    updated_at = _format_timestamp(
        datetime.fromtimestamp(
            max(
                path.stat().st_mtime
                for path in (manifest_path, statement_path, starter_path, hidden_path)
            ),
            tz=timezone.utc,
        )
    )

    return FileProblemSnapshot(
        problemId=str(manifest["problemId"]),
        title=str(manifest["title"]),
        entryFunction=str(manifest["entryFunction"]),
        language=str(manifest["language"]),
        timeLimitMs=int(manifest["timeLimitMs"]),
        memoryLimitKb=int(manifest["memoryLimitKb"]),
        visibility=str(manifest["visibility"]),
        statementMarkdown=statement_path.read_text(encoding="utf-8"),
        starterCode=starter_path.read_text(encoding="utf-8"),
        examples=_normalize_case_list(manifest.get("examples")),
        publicTests=_normalize_case_list(manifest.get("publicTests")),
        hiddenTests=hidden_tests,
        updatedAt=updated_at,
    )


def _write_problem_files(
    problem_dir: Path,
    detail: AdminProblemDetail,
    *,
    examples: list[dict[str, Any]],
    public_tests: list[dict[str, Any]],
    include_hidden: bool,
) -> None:
    manifest = {
        "problemId": detail.problemId,
        "title": detail.title,
        "language": detail.language,
        "entryFunction": detail.entryFunction,
        "timeLimitMs": detail.timeLimitMs,
        "memoryLimitKb": detail.memoryLimitKb,
        "visibility": detail.visibility,
        "examples": examples,
        "publicTests": public_tests,
    }
    _write_manifest(problem_dir / "manifest.json", manifest)
    (problem_dir / "statement.md").write_text(detail.statementMarkdown, encoding="utf-8")
    (problem_dir / "starter.py").write_text(detail.starterCode, encoding="utf-8")
    if include_hidden:
        (problem_dir / "hidden.json").write_text("[]\n", encoding="utf-8")


def _write_manifest(manifest_path: Path, manifest: dict[str, Any]) -> None:
    manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")


def _read_problem_manifest(problem_dir: Path) -> dict[str, Any] | None:
    manifest_path = problem_dir / "manifest.json"
    if not manifest_path.exists():
        return None

    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ProblemOperationValidationError("Problem manifest is invalid JSON.") from exc

    if not isinstance(raw, dict):
        raise ProblemOperationValidationError("Problem manifest must contain a JSON object.")
    return raw


def _read_hidden_tests(problem_dir: Path) -> list[dict[str, Any]] | None:
    hidden_path = problem_dir / "hidden.json"
    if not hidden_path.exists():
        return None

    try:
        raw = json.loads(hidden_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ProblemOperationValidationError("Hidden tests file is invalid JSON.") from exc

    return _normalize_case_list(raw)


def _normalize_case_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        output = item.get("output")
        if "output" not in item and "expected" in item:
            output = item.get("expected")
        normalized.append({"input": item.get("input"), "output": output})

    return normalized


def _collect_publish_missing(problem_dir: Path, manifest: dict[str, Any]) -> list[str]:
    missing: list[str] = []

    if not isinstance(manifest.get("title"), str) or not manifest["title"].strip():
        missing.append("title")
    if not isinstance(manifest.get("entryFunction"), str) or not manifest["entryFunction"].strip():
        missing.append("entryFunction")
    if not (problem_dir / "statement.md").exists():
        missing.append("statement.md")
    if not (problem_dir / "starter.py").exists():
        missing.append("starter.py")

    public_tests = manifest.get("publicTests")
    if not isinstance(public_tests, list) or len(_normalize_case_list(public_tests)) < 1:
        missing.append("publicTests")

    hidden_tests = _read_hidden_tests(problem_dir)
    if hidden_tests is None or len(hidden_tests) < 1:
        missing.append("hiddenTests")

    return missing


def _snapshot_to_problem_preview(snapshot: FileProblemSnapshot) -> AdminProblemPreview:
    return AdminProblemPreview(
        problemId=snapshot.problemId,
        title=snapshot.title,
        statementMarkdown=snapshot.statementMarkdown,
        examples=[
            AdminProblemCase(input=example["input"], output=example["output"])
            for example in snapshot.examples
        ],
        publicTests=[
            AdminProblemCase(input=test_case["input"], output=test_case["output"])
            for test_case in snapshot.publicTests
        ],
    )


def _build_content_digest(payload: AdminProblemUpdateRequest) -> str:
    raw = json.dumps(
        {
            "entryFunction": payload.entryFunction,
            "examples": [example.model_dump(mode="json") for example in payload.examples],
            "language": payload.language,
            "memoryLimitKb": payload.memoryLimitKb,
            "problemId": payload.problemId,
            "starterCode": payload.starterCode,
            "statementMarkdown": payload.statementMarkdown,
            "timeLimitMs": payload.timeLimitMs,
            "title": payload.title,
            "visibility": payload.visibility,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
