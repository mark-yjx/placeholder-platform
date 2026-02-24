BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  publication_state TEXT NOT NULL CHECK (publication_state IN ('draft', 'published', 'unpublished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  problem_id TEXT NOT NULL REFERENCES problems(id),
  language TEXT NOT NULL CHECK (language = 'python'),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'finished', 'failed')),
  source_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judge_results (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('AC', 'WA', 'TLE', 'RE', 'CE')),
  time_ms INTEGER NOT NULL CHECK (time_ms >= 0),
  memory_kb INTEGER NOT NULL CHECK (memory_kb >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
