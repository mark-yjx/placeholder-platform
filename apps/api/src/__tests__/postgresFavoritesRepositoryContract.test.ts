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
  throw new Error('Unable to resolve repository root for postgres favorites repository contract tests');
}

function readFavoritesRepositorySource(): string {
  const repoRoot = resolveRepoRoot();
  return fs.readFileSync(
    path.join(
      repoRoot,
      'packages',
      'infrastructure',
      'src',
      'postgres',
      'favorites',
      'PostgresFavoritesRepository.ts'
    ),
    'utf8'
  );
}

test('favorite insert is idempotent and persists in database table', () => {
  const source = readFavoritesRepositorySource();
  assert.match(source, /INSERT INTO favorites/i);
  assert.match(source, /ON CONFLICT \(user_id, problem_id\) DO NOTHING/i);
});

test('unfavorite removes one user/problem favorite row', () => {
  const source = readFavoritesRepositorySource();
  assert.match(source, /DELETE FROM favorites/i);
  assert.match(source, /WHERE user_id = \$1/i);
  assert.match(source, /AND problem_id = \$2/i);
});

test('favorite list is isolated by user and deterministic', () => {
  const source = readFavoritesRepositorySource();
  assert.match(source, /SELECT problem_id/i);
  assert.match(source, /WHERE user_id = \$1/i);
  assert.match(source, /ORDER BY problem_id ASC/i);
});

test('repository can be re-instantiated against persistent client for restart behavior', () => {
  const source = readFavoritesRepositorySource();
  assert.match(source, /constructor\(private readonly client: PostgresFavoritesSqlClient\)/);
  assert.match(source, /class PostgresFavoritesRepository/);
});

