import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'packages', 'infrastructure', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for postgres reviews repository contract tests');
}

function readReviewsRepositorySource(): string {
  const repoRoot = resolveRepoRoot();
  return fs.readFileSync(
    path.join(
      repoRoot,
      'packages',
      'infrastructure',
      'src',
      'postgres',
      'reviews',
      'PostgresReviewsRepository.ts'
    ),
    'utf8'
  );
}

test('one-review-per-user-per-problem policy is encoded via upsert', () => {
  const source = readReviewsRepositorySource();
  assert.match(source, /INSERT INTO reviews/i);
  assert.match(source, /ON CONFLICT \(user_id, problem_id\) DO UPDATE/i);
  assert.match(source, /SET sentiment = EXCLUDED\.sentiment/i);
  assert.match(source, /content = EXCLUDED\.content/i);
});

test('review sentiment and text are stored and retrievable', () => {
  const source = readReviewsRepositorySource();
  assert.match(source, /VALUES \(\$1, \$2, \$3, \$4\)/i);
  assert.match(source, /SELECT[\s\S]*sentiment[\s\S]*content/i);
  assert.match(source, /parseSentiment\(row\.sentiment\)/);
});

test('ownership constraint is enforced for review delete operation', () => {
  const source = readReviewsRepositorySource();
  assert.match(source, /DELETE FROM reviews/i);
  assert.match(source, /WHERE user_id = \$1/i);
  assert.match(source, /AND problem_id = \$2/i);
});

test('repository is stateless and restart-safe with persistent sql client', () => {
  const source = readReviewsRepositorySource();
  assert.match(source, /constructor\(private readonly client: PostgresReviewsSqlClient\)/);
  assert.match(source, /class PostgresReviewsRepository/);
});

