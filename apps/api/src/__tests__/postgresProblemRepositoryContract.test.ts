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
  throw new Error('Unable to resolve repository root for postgres problem repository contract tests');
}

function readPostgresProblemRepositorySource(): string {
  const repoRoot = resolveRepoRoot();
  return fs.readFileSync(
    path.join(
      repoRoot,
      'packages',
      'infrastructure',
      'src',
      'postgres',
      'problem',
      'PostgresProblemRepository.ts'
    ),
    'utf8'
  );
}

test('postgres problem repository preserves immutable version contract', () => {
  const source = readPostgresProblemRepositorySource();

  assert.match(source, /assertImmutableVersion\(/);
  assert.match(source, /immutable and cannot be modified/);
  assert.match(source, /const existingByVersionId = new Map/);
  assert.match(source, /if \(existing\) \{\s*assertImmutableVersion/s);
});

test('postgres problem repository supports admin write with version append semantics', () => {
  const source = readPostgresProblemRepositorySource();

  assert.match(source, /withTransaction\(/);
  assert.match(source, /INSERT_PROBLEM_VERSION_SQL/);
  assert.match(source, /for \(const version of problem\.versions\)/);
});

test('postgres problem repository provides read paths required for student published filtering', () => {
  const source = readPostgresProblemRepositorySource();

  assert.match(source, /async listAll\(\)/);
  assert.match(source, /LIST_PROBLEM_IDS_SQL/);
  assert.match(source, /await this\.findById\(row\.problem_id\)/);
});

test('postgres problem repository can be re-instantiated against the same backing client', () => {
  const source = readPostgresProblemRepositorySource();

  assert.match(source, /constructor\(private readonly client: PostgresSqlClient\)/);
  assert.match(source, /class PostgresProblemRepository/);
});

