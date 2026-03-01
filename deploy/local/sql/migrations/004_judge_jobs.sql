BEGIN;

CREATE TABLE IF NOT EXISTS judge_jobs (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  problem_id TEXT NOT NULL REFERENCES problems(id),
  problem_version_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language = 'python'),
  source_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS judge_jobs_created_at_idx
  ON judge_jobs (created_at, submission_id);

COMMIT;
