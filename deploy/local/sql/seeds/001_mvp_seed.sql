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
  ('collapse', 'Collapse Identical Digits', 'published')
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    publication_state = EXCLUDED.publication_state;

INSERT INTO problem_versions (id, problem_id, version_number, title, statement, publication_state)
VALUES
  (
    'collapse-v1',
    'collapse',
    1,
    'Collapse Identical Digits',
    $$# Collapse Identical Digits

A sequence of identical digits is collapsed to one digit
in the returned integer.

You can assume that the function is called with an integer as argument.
$$,
    'published'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO problem_version_assets (
  problem_version_id,
  entry_function,
  language,
  visibility,
  time_limit_ms,
  memory_limit_kb,
  difficulty,
  tags,
  manifest_version,
  author,
  examples,
  starter_code,
  content_digest
)
VALUES
  (
    'collapse-v1',
    'collapse',
    'python',
    'public',
    2000,
    65536,
    'easy',
    '["digits","iteration"]'::jsonb,
    '1.0.0',
    'COMP9021 Staff',
    '[{"input":"111","output":"1"},{"input":"111122223333","output":"123"}]'::jsonb,
$$def collapse(number):
    """Collapse adjacent repeated digits while preserving sign."""
    # YOUR CODE HERE
    raise NotImplementedError
$$,
    '80eb5ef2cfe2f2ec81f65a90aa834fded90dd2148e742ffb73b9f297eb875e7f'
  )
ON CONFLICT (problem_version_id) DO NOTHING;

INSERT INTO problem_version_tests (problem_version_id, test_type, position, input, expected)
VALUES
  ('collapse-v1', 'public', 1, '0'::jsonb, '0'::jsonb),
  ('collapse-v1', 'public', 2, '12321'::jsonb, '12321'::jsonb),
  ('collapse-v1', 'public', 3, '-1111222232222111'::jsonb, '-12321'::jsonb),
  ('collapse-v1', 'hidden', 1, '1111111111111'::jsonb, '1'::jsonb),
  ('collapse-v1', 'hidden', 2, '-2222222222'::jsonb, '-2'::jsonb),
  ('collapse-v1', 'hidden', 3, '1000000000000000000001'::jsonb, '101'::jsonb),
  ('collapse-v1', 'hidden', 4, '-900111212777394440300'::jsonb, '-9012127394030'::jsonb)
ON CONFLICT (problem_version_id, test_type, position) DO NOTHING;

INSERT INTO submissions (id, user_id, problem_id, problem_version_id, language, status, source_code)
VALUES
  (
    'sub-1',
    'student-1',
    'collapse',
    'collapse-v1',
    'python',
    'finished',
    $$def collapse(number):
    return 0 if number == 0 else int(str(number)[0])
$$
  )
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    problem_id = EXCLUDED.problem_id,
    problem_version_id = EXCLUDED.problem_version_id,
    language = EXCLUDED.language,
    status = EXCLUDED.status,
    source_code = EXCLUDED.source_code;

INSERT INTO judge_results (submission_id, verdict, time_ms, memory_kb)
VALUES
  ('sub-1', 'AC', 120, 2048)
ON CONFLICT (submission_id) DO UPDATE
SET verdict = EXCLUDED.verdict,
    time_ms = EXCLUDED.time_ms,
    memory_kb = EXCLUDED.memory_kb,
    updated_at = NOW();

COMMIT;
