from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.problems import AdminProblemDetail, AdminProblemListItem, AdminProblemUpdateRequest

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"

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


class AdminProblemListService(Protocol):
    def list_problems(self) -> list[AdminProblemListItem]:
        ...


class AdminProblemService(AdminProblemListService, Protocol):
    def get_problem(self, problem_id: str) -> AdminProblemDetail | None:
        ...

    def update_problem(
        self, problem_id: str, payload: AdminProblemUpdateRequest
    ) -> AdminProblemDetail | None:
        ...


@dataclass(frozen=True)
class PsycopgProblemListService:
    database_url: str

    @classmethod
    def from_env(cls) -> "PsycopgProblemListService":
        return cls(database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))

    def list_problems(self) -> list[AdminProblemListItem]:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(LIST_ADMIN_PROBLEMS_SQL)
                rows = cursor.fetchall()

        return [
            AdminProblemListItem(
                problemId=str(row["problem_id"]),
                title=str(row["title"]),
                # Fallback to publication_state only when a manifest visibility row is absent.
                visibility=str(row["visibility"]),
                updatedAt=_format_timestamp(row["updated_at"]),
            )
            for row in rows
        ]

    def get_problem(self, problem_id: str) -> AdminProblemDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(ADMIN_PROBLEM_DETAIL_SQL, {"problem_id": problem_id})
                row = cursor.fetchone()

        return _row_to_problem_detail(row) if row else None

    def update_problem(
        self, problem_id: str, payload: AdminProblemUpdateRequest
    ) -> AdminProblemDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.transaction():
                with connection.cursor() as cursor:
                    cursor.execute(ADMIN_PROBLEM_DETAIL_SQL, {"problem_id": problem_id})
                    existing = cursor.fetchone()
                    if existing is None:
                        return None

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


def _format_timestamp(value: datetime | str) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)


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
        starterCode=str(row["starter_code"]),
        updatedAt=_format_timestamp(row["updated_at"]),
    )


def _build_content_digest(payload: AdminProblemUpdateRequest) -> str:
    raw = json.dumps(
        {
            "entryFunction": payload.entryFunction,
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
