import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoRoot } from './support/resolveRepoRoot';

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

test('root README documents the npm-driven local quick start and docs entry points', () => {
  const readme = readFile('README.md');

  assert.match(readme, /npm run local:up/);
  assert.match(readme, /npm run local:db:setup/);
  assert.match(readme, /npm run import:problems -- --dir problems/);
  assert.match(readme, /\[Local Development\]\(\.\/docs\/local-development\.md\)/);
  assert.match(readme, /\[Runtime Metrics\]\(\.\/docs\/runtime-metrics\.md\)/);
  assert.doesNotMatch(readme, /docker compose -f deploy\/local\/docker-compose\.yml ps/);
});

test('local development doc keeps the compose-managed student stack and admin stack separated', () => {
  const localDevDoc = readFile('docs', 'local-development.md');

  assert.match(localDevDoc, /Start the compose-managed local stack/i);
  assert.match(localDevDoc, /npm run local:up/);
  assert.match(localDevDoc, /npm run local:db:setup/);
  assert.match(localDevDoc, /npm run import:problems -- --dir problems/);
  assert.match(localDevDoc, /the student API on `http:\/\/localhost:3100`/i);
  assert.match(localDevDoc, /judge worker/i);
  assert.match(localDevDoc, /run `admin-api` locally/i);
  assert.match(localDevDoc, /VITE_ADMIN_API_BASE_URL='http:\/\/127\.0\.0\.1:8200'/);
});

test('problem format and local development docs define the repository-managed import workflow', () => {
  const localDevDoc = readFile('docs', 'local-development.md');
  const problemFormatDoc = readFile('docs', 'problem-format.md');

  assert.match(localDevDoc, /npm run local:up/);
  assert.match(localDevDoc, /npm run local:db:setup/);
  assert.match(localDevDoc, /npm run import:problems -- --dir problems/);

  assert.match(problemFormatDoc, /problems\/<problemId>\//);
  assert.match(problemFormatDoc, /manifest\.json/);
  assert.match(problemFormatDoc, /statement\.md/);
  assert.match(problemFormatDoc, /starter\.py/);
  assert.match(problemFormatDoc, /hidden\.json/);
  assert.match(problemFormatDoc, /publicTests/i);
  assert.match(problemFormatDoc, /tools\/scripts\/import-problems\.mjs/);
  assert.match(problemFormatDoc, /hidden tests (?:are|remain) judge-only/i);
});
