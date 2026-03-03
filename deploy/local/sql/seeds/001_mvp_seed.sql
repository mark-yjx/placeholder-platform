BEGIN;

INSERT INTO users (id, email, role, password_hash)
VALUES
  ('admin-1', 'admin@example.com', 'admin', 'scrypt$oj-local-salt$5d579cb40595a26640cd9afa26ca4311172b9046e465a8a6d79f70a42a43571e690e040047100632901310f4cc9229ee32cbd0edd8205a87554b8ed4ae58be4e'),
  ('student-1', 'student1@example.com', 'student', 'scrypt$oj-local-salt$3e8da74f3ca963c36be4bf3b076b1dc336d1b3f0a608e8696cd949d48f77cac8d46e74a6ed22a3df7675ed2e5877908f02fa0bccc4fcba301c41cf827f02a4e0'),
  ('student-2', 'student2@example.com', 'student', 'scrypt$oj-local-salt$3e8da74f3ca963c36be4bf3b076b1dc336d1b3f0a608e8696cd949d48f77cac8d46e74a6ed22a3df7675ed2e5877908f02fa0bccc4fcba301c41cf827f02a4e0')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash;

INSERT INTO problems (id, title, publication_state)
VALUES
  ('problem-1', 'Two Sum', 'published'),
  ('problem-2', 'FizzBuzz', 'published')
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    publication_state = EXCLUDED.publication_state;

INSERT INTO submissions (id, user_id, problem_id, problem_version_id, language, status, source_code)
VALUES
  ('sub-1', 'student-1', 'problem-1', 'problem-1-v1', 'python', 'finished', 'print(42)'),
  ('sub-2', 'student-1', 'problem-2', 'problem-2-v1', 'python', 'finished', 'print(1)'),
  ('sub-3', 'student-2', 'problem-1', 'problem-1-v1', 'python', 'finished', 'print(2)')
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    problem_id = EXCLUDED.problem_id,
    problem_version_id = EXCLUDED.problem_version_id,
    language = EXCLUDED.language,
    status = EXCLUDED.status,
    source_code = EXCLUDED.source_code;

INSERT INTO judge_results (submission_id, verdict, time_ms, memory_kb)
VALUES
  ('sub-1', 'AC', 120, 2048),
  ('sub-2', 'WA', 140, 2052),
  ('sub-3', 'AC', 100, 2000)
ON CONFLICT (submission_id) DO UPDATE
SET verdict = EXCLUDED.verdict,
    time_ms = EXCLUDED.time_ms,
    memory_kb = EXCLUDED.memory_kb,
    updated_at = NOW();

COMMIT;
