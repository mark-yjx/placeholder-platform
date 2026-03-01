BEGIN;

ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS problem_version_id TEXT;

UPDATE submissions
SET problem_version_id = CONCAT(problem_id, '-v1')
WHERE problem_version_id IS NULL;

ALTER TABLE submissions
ALTER COLUMN problem_version_id SET NOT NULL;

ALTER TABLE submissions
ALTER COLUMN status SET DEFAULT 'queued';

CREATE OR REPLACE FUNCTION guard_submission_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'queued' AND NEW.status = 'running' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'running' AND NEW.status IN ('finished', 'failed') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid submission status transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submission_status_transition_guard ON submissions;

CREATE TRIGGER submission_status_transition_guard
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION guard_submission_status_transition();

COMMIT;
