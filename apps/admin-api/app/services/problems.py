from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.problems import AdminProblemListItem

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


class AdminProblemListService(Protocol):
    def list_problems(self) -> list[AdminProblemListItem]:
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


def _format_timestamp(value: datetime | str) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value)
