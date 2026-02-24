BEGIN;

CREATE TABLE IF NOT EXISTS problem_versions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  publication_state TEXT NOT NULL CHECK (publication_state IN ('draft', 'published', 'unpublished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (problem_id, version_number)
);

CREATE OR REPLACE FUNCTION prevent_problem_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'problem_versions rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_problem_versions_immutable ON problem_versions;
CREATE TRIGGER trg_problem_versions_immutable
BEFORE UPDATE OR DELETE ON problem_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_problem_version_mutation();

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('like', 'dislike')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_versions_problem_id ON problem_versions(problem_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_problem_id ON favorites(problem_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_problem_id ON reviews(problem_id);

COMMIT;
