BEGIN;

CREATE TABLE IF NOT EXISTS problem_version_tests (
  id BIGSERIAL PRIMARY KEY,
  problem_version_id TEXT NOT NULL REFERENCES problem_versions(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL CHECK (test_type IN ('public', 'hidden')),
  position INTEGER NOT NULL CHECK (position > 0),
  input JSONB NOT NULL,
  expected JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (problem_version_id, test_type, position)
);

CREATE INDEX IF NOT EXISTS idx_problem_version_tests_problem_version_id
  ON problem_version_tests(problem_version_id);

COMMIT;
