from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.tests import (
    AdminProblemTestCase,
    AdminProblemTestsDetail,
    AdminProblemTestsUpdateRequest,
)

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"

LATEST_PROBLEM_VERSION_SQL = """
SELECT
  p.id AS problem_id,
  pv.id AS version_id,
  pv.version_number AS version_number,
  pv.title AS title,
  pv.statement AS statement_markdown,
  pv.publication_state AS publication_state,
  pva.entry_function AS entry_function,
  pva.language AS language,
  pva.visibility AS visibility,
  pva.time_limit_ms AS time_limit_ms,
  pva.memory_limit_kb AS memory_limit_kb,
  pva.difficulty AS difficulty,
  pva.tags AS tags,
  pva.manifest_version AS manifest_version,
  pva.author AS author,
  pva.starter_code AS starter_code,
  pva.content_digest AS content_digest
FROM problems p
JOIN LATERAL (
  SELECT
    id,
    version_number,
    title,
    statement,
    publication_state
  FROM problem_versions
  WHERE problem_id = p.id
  ORDER BY version_number DESC
  LIMIT 1
) pv ON TRUE
LEFT JOIN problem_version_assets pva
  ON pva.problem_version_id = pv.id
WHERE p.id = %(problem_id)s
"""

LIST_PROBLEM_TESTS_SQL = """
SELECT
  test_type,
  input::text AS input_json,
  expected::text AS output_json
FROM problem_version_tests
WHERE problem_version_id = %(version_id)s
ORDER BY
  CASE test_type WHEN 'public' THEN 0 ELSE 1 END ASC,
  position ASC
"""

PROBLEM_VERSION_NUMBER_SQL = """
SELECT COALESCE(MAX(version_number), 0) AS latest_version_number
FROM problem_versions
WHERE problem_id = %(problem_id)s
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

INSERT_PROBLEM_TEST_SQL = """
INSERT INTO problem_version_tests (
  problem_version_id,
  test_type,
  position,
  input,
  expected
)
VALUES (
  %(version_id)s,
  %(test_type)s,
  %(position)s,
  %(input_json)s::jsonb,
  %(output_json)s::jsonb
)
"""


class AdminProblemTestService(Protocol):
    def get_tests(self, problem_id: str) -> AdminProblemTestsDetail | None:
        ...

    def update_tests(
        self, problem_id: str, payload: AdminProblemTestsUpdateRequest
    ) -> AdminProblemTestsDetail | None:
        ...


@dataclass(frozen=True)
class PsycopgAdminProblemTestService:
    database_url: str

    @classmethod
    def from_env(cls) -> "PsycopgAdminProblemTestService":
        return cls(database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))

    def get_tests(self, problem_id: str) -> AdminProblemTestsDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            latest_version = _fetch_latest_problem_version(connection, problem_id)
            if latest_version is None:
                return None

            rows = _fetch_problem_tests(connection, str(latest_version["version_id"]))

        return _build_problem_tests_detail(problem_id, rows)

    def update_tests(
        self, problem_id: str, payload: AdminProblemTestsUpdateRequest
    ) -> AdminProblemTestsDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.transaction():
                latest_version = _fetch_latest_problem_version(connection, problem_id)
                if latest_version is None:
                    return None

                with connection.cursor() as cursor:
                    cursor.execute(PROBLEM_VERSION_NUMBER_SQL, {"problem_id": problem_id})
                    version_row = cursor.fetchone()
                    next_version_number = int(version_row["latest_version_number"]) + 1
                    version_id = f"{problem_id}-v{next_version_number}"
                    params = {
                        "problem_id": problem_id,
                        "version_id": version_id,
                        "version_number": next_version_number,
                        "title": latest_version["title"],
                        "statement_markdown": latest_version["statement_markdown"],
                        "publication_state": latest_version["publication_state"],
                        "entry_function": latest_version["entry_function"],
                        "language": latest_version["language"],
                        "visibility": latest_version["visibility"],
                        "time_limit_ms": latest_version["time_limit_ms"],
                        "memory_limit_kb": latest_version["memory_limit_kb"],
                        "difficulty": latest_version["difficulty"],
                        "tags": (
                            json.dumps(latest_version["tags"])
                            if latest_version["tags"] is not None
                            else None
                        ),
                        "manifest_version": latest_version["manifest_version"],
                        "author": latest_version["author"],
                        "starter_code": latest_version["starter_code"],
                        "content_digest": latest_version["content_digest"],
                    }

                    cursor.execute(INSERT_PROBLEM_VERSION_SQL, params)
                    cursor.execute(INSERT_PROBLEM_VERSION_ASSETS_SQL, params)

                    _insert_tests(cursor, version_id, "public", payload.publicTests)
                    _insert_tests(cursor, version_id, "hidden", payload.hiddenTests)

            rows = _fetch_problem_tests(connection, version_id)

        return _build_problem_tests_detail(problem_id, rows)


def _fetch_latest_problem_version(connection: psycopg.Connection, problem_id: str) -> dict | None:
    with connection.cursor() as cursor:
        cursor.execute(LATEST_PROBLEM_VERSION_SQL, {"problem_id": problem_id})
        return cursor.fetchone()


def _fetch_problem_tests(connection: psycopg.Connection, version_id: str) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(LIST_PROBLEM_TESTS_SQL, {"version_id": version_id})
        return list(cursor.fetchall())


def _insert_tests(
    cursor: psycopg.Cursor,
    version_id: str,
    test_type: str,
    tests: list[AdminProblemTestCase],
) -> None:
    for position, test_case in enumerate(tests, start=1):
        cursor.execute(
            INSERT_PROBLEM_TEST_SQL,
            {
                "version_id": version_id,
                "test_type": test_type,
                "position": position,
                "input_json": test_case.input,
                "output_json": test_case.output,
            },
        )


def _build_problem_tests_detail(problem_id: str, rows: list[dict]) -> AdminProblemTestsDetail:
    public_tests: list[AdminProblemTestCase] = []
    hidden_tests: list[AdminProblemTestCase] = []

    for row in rows:
        test_case = AdminProblemTestCase(
            input=str(row["input_json"]),
            output=str(row["output_json"]),
        )
        if row["test_type"] == "public":
            public_tests.append(test_case)
        else:
            hidden_tests.append(test_case)

    return AdminProblemTestsDetail(
        problemId=problem_id,
        publicTests=public_tests,
        hiddenTests=hidden_tests,
    )
