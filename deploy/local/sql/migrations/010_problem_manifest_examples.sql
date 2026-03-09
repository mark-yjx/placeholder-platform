BEGIN;

ALTER TABLE problem_version_assets
ADD COLUMN IF NOT EXISTS examples JSONB;

ALTER TABLE problem_version_assets
DROP CONSTRAINT IF EXISTS problem_version_assets_examples_array_check;

ALTER TABLE problem_version_assets
ADD CONSTRAINT problem_version_assets_examples_array_check
CHECK (examples IS NULL OR jsonb_typeof(examples) = 'array');

COMMIT;
