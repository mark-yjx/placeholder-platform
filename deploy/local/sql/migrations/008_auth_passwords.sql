BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE users
SET password_hash = 'scrypt$oj-local-salt$5d579cb40595a26640cd9afa26ca4311172b9046e465a8a6d79f70a42a43571e690e040047100632901310f4cc9229ee32cbd0edd8205a87554b8ed4ae58be4e'
WHERE email = 'admin@example.com' AND (password_hash IS NULL OR password_hash = '');

UPDATE users
SET password_hash = 'scrypt$oj-local-salt$3e8da74f3ca963c36be4bf3b076b1dc336d1b3f0a608e8696cd949d48f77cac8d46e74a6ed22a3df7675ed2e5877908f02fa0bccc4fcba301c41cf827f02a4e0'
WHERE email IN ('student1@example.com', 'student2@example.com')
  AND (password_hash IS NULL OR password_hash = '');

ALTER TABLE users
ALTER COLUMN password_hash SET NOT NULL;

COMMIT;
