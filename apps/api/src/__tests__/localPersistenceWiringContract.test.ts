import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'api', 'src', 'runtime'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for local persistence wiring contract tests');
}

function readLocalWiringSource(): string {
  const repoRoot = resolveRepoRoot();
  return fs.readFileSync(
    path.join(repoRoot, 'apps', 'api', 'src', 'runtime', 'localPersistenceWiring.ts'),
    'utf8'
  );
}

test('local runtime wiring defaults to Postgres adapter selection', () => {
  const source = readLocalWiringSource();
  assert.match(source, /runtimeEnv === 'local' \? 'postgres' : 'in-memory'/);
});

test('local runtime wiring binds problem, favorites, reviews, submissions, and queue to Postgres adapters', () => {
  const source = readLocalWiringSource();
  assert.match(source, /new PostgresProblemRepository/);
  assert.match(source, /new PostgresFavoritesRepository/);
  assert.match(source, /new PostgresReviewsRepository/);
  assert.match(source, /new PostgresSubmissionRepository/);
  assert.match(source, /new PostgresJudgeJobQueue/);
});

test('local runtime wiring composes existing services without business logic changes', () => {
  const source = readLocalWiringSource();
  assert.match(source, /new ProblemAdminCrudService\(problems\)/);
  assert.match(source, /new StudentProblemQueryService\(problems\)/);
  assert.match(source, /new FavoritesService\(favorites\)/);
  assert.match(source, /new ReviewsService\(reviews\)/);
  assert.match(source, /new CreateSubmissionUseCase\(/);
  assert.match(source, /new SubmissionPolicyService\(\)/);
});

test('wiring remains restart-safe through injected persistent sql clients', () => {
  const source = readLocalWiringSource();
  assert.match(source, /sqlClients\?: PersistenceSqlClients/);
  assert.match(source, /requirePostgresClient/);
});
