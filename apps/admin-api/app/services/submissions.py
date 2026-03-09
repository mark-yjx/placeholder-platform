from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.submissions import AdminSubmissionDetail, AdminSubmissionListItem

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"

LIST_ADMIN_SUBMISSIONS_SQL = """
SELECT
  s.id AS submission_id,
  s.user_id AS owner_user_id,
  s.problem_id AS problem_id,
  s.status AS status,
  jr.verdict AS verdict,
  jr.time_ms AS time_ms,
  jr.memory_kb AS memory_kb,
  s.created_at AS submitted_at
FROM submissions s
LEFT JOIN judge_results jr
  ON jr.submission_id = s.id
ORDER BY s.created_at DESC, s.id DESC
"""

ADMIN_SUBMISSION_DETAIL_SQL = """
SELECT
  s.id AS submission_id,
  s.user_id AS owner_user_id,
  s.problem_id AS problem_id,
  s.status AS status,
  jr.verdict AS verdict,
  jr.time_ms AS time_ms,
  jr.memory_kb AS memory_kb,
  s.failure_reason AS failure_reason,
  s.source_code AS source_snapshot,
  s.created_at AS submitted_at
FROM submissions s
LEFT JOIN judge_results jr
  ON jr.submission_id = s.id
WHERE s.id = %(submission_id)s
"""


class AdminSubmissionService(Protocol):
    def list_submissions(self) -> list[AdminSubmissionListItem]:
        ...

    def get_submission(self, submission_id: str) -> AdminSubmissionDetail | None:
        ...


@dataclass(frozen=True)
class PsycopgAdminSubmissionService:
    database_url: str

    @classmethod
    def from_env(cls) -> "PsycopgAdminSubmissionService":
        return cls(database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))

    def list_submissions(self) -> list[AdminSubmissionListItem]:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(LIST_ADMIN_SUBMISSIONS_SQL)
                rows = cursor.fetchall()

        return [_row_to_submission_list_item(row) for row in rows]

    def get_submission(self, submission_id: str) -> AdminSubmissionDetail | None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(ADMIN_SUBMISSION_DETAIL_SQL, {"submission_id": submission_id})
                row = cursor.fetchone()

        return _row_to_submission_detail(row) if row else None


def _row_to_submission_list_item(row: dict) -> AdminSubmissionListItem:
    return AdminSubmissionListItem(
        submissionId=str(row["submission_id"]),
        ownerUserId=str(row["owner_user_id"]),
        problemId=str(row["problem_id"]),
        status=str(row["status"]),
        verdict=str(row["verdict"]) if row["verdict"] is not None else None,
        timeMs=int(row["time_ms"]) if row["time_ms"] is not None else None,
        memoryKb=int(row["memory_kb"]) if row["memory_kb"] is not None else None,
        submittedAt=_format_timestamp(row["submitted_at"]),
    )


def _row_to_submission_detail(row: dict) -> AdminSubmissionDetail:
    return AdminSubmissionDetail(
        submissionId=str(row["submission_id"]),
        ownerUserId=str(row["owner_user_id"]),
        problemId=str(row["problem_id"]),
        status=str(row["status"]),
        verdict=str(row["verdict"]) if row["verdict"] is not None else None,
        timeMs=int(row["time_ms"]) if row["time_ms"] is not None else None,
        memoryKb=int(row["memory_kb"]) if row["memory_kb"] is not None else None,
        failureReason=str(row["failure_reason"]) if row["failure_reason"] is not None else None,
        errorDetail=None,
        submittedAt=_format_timestamp(row["submitted_at"]),
        sourceSnapshot=str(row["source_snapshot"]) if row["source_snapshot"] is not None else None,
    )


def _format_timestamp(value: datetime | str) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)
