import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'tools', 'scripts', 'import-problems.mjs'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for manifest persistence contract tests');
}

function readText(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

test('import persistence stores optional manifest metadata alongside problem assets', () => {
  const importer = readText('tools', 'scripts', 'import-problems.mjs');

  assert.match(importer, /INSERT INTO problem_version_assets/i);
  assert.match(importer, /difficulty,/i);
  assert.match(importer, /tags,/i);
  assert.match(importer, /manifest_version,/i);
  assert.match(importer, /author,/i);
  assert.match(importer, /JSON\.stringify\(problem\.tags \?\? \[\]\)/);
});

test('student-facing problem projections do not expose hidden or raw test payloads', () => {
  const service = readText('packages', 'application', 'src', 'problem', 'StudentProblemQueryService.ts');

  assert.doesNotMatch(service, /hiddenTests/);
  assert.doesNotMatch(service, /publicTests/);
  assert.doesNotMatch(service, /test_type/);
  assert.match(service, /problemId:/);
  assert.match(service, /versionId:/);
  assert.match(service, /title:/);
  assert.match(service, /statementMarkdown:/);
  assert.match(service, /entryFunction:/);
  assert.match(service, /timeLimitMs:/);
  assert.match(service, /memoryLimitKb:/);
  assert.match(service, /starterCode:/);
});
