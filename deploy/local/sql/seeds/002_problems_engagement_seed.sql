BEGIN;

INSERT INTO problem_versions (id, problem_id, version_number, title, statement, publication_state)
VALUES
  ('problem-1-v1', 'problem-1', 1, 'Two Sum', 'Find indices of two numbers that sum to target.', 'published'),
  ('problem-2-v1', 'problem-2', 1, 'FizzBuzz', 'Print numbers with FizzBuzz rules.', 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO favorites (user_id, problem_id)
VALUES
  ('student-1', 'problem-1')
ON CONFLICT (user_id, problem_id) DO NOTHING;

INSERT INTO reviews (user_id, problem_id, sentiment, content)
VALUES
  ('student-1', 'problem-1', 'like', 'Great starter problem.')
ON CONFLICT (user_id, problem_id) DO NOTHING;

COMMIT;
