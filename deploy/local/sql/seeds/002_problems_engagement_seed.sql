BEGIN;

INSERT INTO favorites (user_id, problem_id)
VALUES
  ('student-1', 'collapse')
ON CONFLICT (user_id, problem_id) DO NOTHING;

INSERT INTO reviews (user_id, problem_id, sentiment, content)
VALUES
  ('student-1', 'collapse', 'like', 'Clear starter and examples.')
ON CONFLICT (user_id, problem_id) DO NOTHING;

COMMIT;
