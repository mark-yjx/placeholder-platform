BEGIN;

CREATE TABLE IF NOT EXISTS problem_version_assets (
  problem_version_id TEXT PRIMARY KEY REFERENCES problem_versions(id) ON DELETE CASCADE,
  entry_function TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language = 'python'),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  time_limit_ms INTEGER NOT NULL CHECK (time_limit_ms > 0),
  memory_limit_kb INTEGER NOT NULL CHECK (memory_limit_kb > 0),
  starter_code TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_version_assets_content_digest
  ON problem_version_assets(content_digest);

COMMIT;
