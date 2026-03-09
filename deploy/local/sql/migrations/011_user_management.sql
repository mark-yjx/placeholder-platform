BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE users
SET display_name = COALESCE(NULLIF(display_name, ''), split_part(email, '@', 1))
WHERE display_name IS NULL OR display_name = '';

ALTER TABLE users
  ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE users
SET updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL;

COMMIT;
