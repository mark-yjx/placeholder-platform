BEGIN;

ALTER TABLE problem_version_assets
ADD COLUMN IF NOT EXISTS difficulty TEXT,
ADD COLUMN IF NOT EXISTS tags JSONB,
ADD COLUMN IF NOT EXISTS manifest_version TEXT,
ADD COLUMN IF NOT EXISTS author TEXT;

ALTER TABLE problem_version_assets
DROP CONSTRAINT IF EXISTS problem_version_assets_tags_array_check;

ALTER TABLE problem_version_assets
ADD CONSTRAINT problem_version_assets_tags_array_check
CHECK (tags IS NULL OR jsonb_typeof(tags) = 'array');

COMMIT;
