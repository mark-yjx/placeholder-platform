ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS failure_reason TEXT;
