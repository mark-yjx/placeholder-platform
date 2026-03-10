from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from app.models.analytics import AdminAnalyticsOverview

DEFAULT_DATABASE_URL = "postgresql://oj:oj@127.0.0.1:5432/oj"

ADMIN_ANALYTICS_OVERVIEW_SQL = """
WITH active_users AS (
  SELECT COUNT(DISTINCT s.user_id) AS active_users
  FROM submissions s
  JOIN users u
    ON u.id = s.user_id
  WHERE u.role = 'student'
    AND s.created_at >= NOW() - INTERVAL '30 days'
),
unique_solves AS (
  SELECT COUNT(*) AS unique_problem_solves
  FROM (
    SELECT s.user_id, s.problem_id
    FROM submissions s
    JOIN judge_results jr
      ON jr.submission_id = s.id
     AND jr.verdict = 'AC'
    JOIN users u
      ON u.id = s.user_id
    WHERE u.role = 'student'
    GROUP BY s.user_id, s.problem_id
  ) solved
)
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT active_users FROM active_users) AS active_users,
  30 AS active_window_days,
  (SELECT COUNT(*) FROM submissions) AS total_submissions,
  (SELECT COUNT(*) FROM judge_results WHERE verdict = 'AC') AS total_accepted_submissions,
  (SELECT unique_problem_solves FROM unique_solves) AS unique_problem_solves
"""


class AdminAnalyticsService(Protocol):
    def get_overview(self) -> AdminAnalyticsOverview:
        ...


@dataclass(frozen=True)
class PsycopgAdminAnalyticsService:
    database_url: str

    @classmethod
    def from_env(cls) -> "PsycopgAdminAnalyticsService":
        return cls(database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))

    def get_overview(self) -> AdminAnalyticsOverview:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(ADMIN_ANALYTICS_OVERVIEW_SQL)
                row = cursor.fetchone()

        if row is None:
            return AdminAnalyticsOverview(
                totalUsers=0,
                activeUsers=0,
                activeWindowDays=30,
                totalSubmissions=0,
                totalAcceptedSubmissions=0,
                uniqueProblemSolves=0,
            )

        return AdminAnalyticsOverview(
            totalUsers=int(row["total_users"] or 0),
            activeUsers=int(row["active_users"] or 0),
            activeWindowDays=int(row["active_window_days"] or 30),
            totalSubmissions=int(row["total_submissions"] or 0),
            totalAcceptedSubmissions=int(row["total_accepted_submissions"] or 0),
            uniqueProblemSolves=int(row["unique_problem_solves"] or 0),
        )
