import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRepoRoot } from './support/resolveRepoRoot';

function readSmokeScript(): string {
  const repoRoot = resolveRepoRoot();
  return fs.readFileSync(path.join(repoRoot, 'tools', 'scripts', 'local-smoke.mjs'), 'utf8');
}

async function importSmokeModule() {
  const repoRoot = resolveRepoRoot();
  return import(pathToFileURL(path.join(repoRoot, 'tools', 'scripts', 'local-smoke.mjs')).href);
}

test('local smoke talks to live API endpoints for login, problem, submissions, favorites, and reviews', () => {
  const script = readSmokeScript();
  assert.doesNotMatch(script, /spawn\('npm', \['run', 'api:start'\]/);
  assert.match(script, /build extension runtime/);
  assert.match(script, /AuthCommands/);
  assert.match(script, /PracticeCommands/);
  assert.match(script, /SessionTokenStore/);
  assert.match(script, /HttpAuthClient/);
  assert.match(script, /HttpPracticeApiClient/);
  assert.match(script, /waitForApiHealthy/);
  assert.match(script, /\/healthz/);
  assert.match(script, /authCommands\.login/);
  assert.match(script, /practiceCommands\.fetchPublishedProblems/);
  assert.match(script, /practiceCommands\.submitCode/);
  assert.match(script, /practiceCommands\.pollSubmissionResult/);
  assert.match(script, /practiceCommands\.listSubmissions/);
  assert.match(script, /\/favorites\//);
  assert.match(script, /\/reviews\//);
});

test('local smoke verifies compose worker processing and persistence after API restart', () => {
  const script = readSmokeScript();
  assert.match(script, /import sample problems/);
  assert.match(script, /npm run import:problems -- --dir problems/);
  assert.match(script, /assertImportedCollapseProblemVisible/);
  assert.match(script, /fetchProblemDetail\('collapse'\)/);
  assert.match(script, /assertImportedCollapseDetail/);
  assert.match(script, /statement\.md/);
  assert.match(script, /starter\.py/);
  assert.match(script, /manifest\.json/);
  assert.match(script, /student-visible problem detail must not expose hidden or raw test definitions/);
  assert.match(script, /login through extension http client/);
  assert.match(script, /fetch problems through extension practice client/);
  assert.match(script, /verify single compose worker service/);
  assert.match(script, /assertSingleComposeWorkerService/);
  assert.match(script, /compose', '-f', composeFile, 'ps', '--services', '--status', 'running'/);
  assert.match(script, /expected exactly one running compose worker service/);
  assert.match(script, /submit through extension practice client and wait for compose worker result/);
  assert.match(script, /waitForExtensionSubmissionTerminal/);
  assert.match(script, /assertWorkerLifecycleLogged/);
  assert.match(script, /assertNoDuplicateWorkerProcessing/);
  assert.match(script, /worker logs missing running event/);
  assert.match(script, /expected exactly one claimed worker event/);
  assert.match(script, /expected exactly one completed worker event/);
  assert.match(script, /reject missing configured entryFunction payload/);
  assert.match(script, /assertMissingEntrypointRejected/);
  assert.match(script, /extractEntrypointPayload/);
  assert.match(script, /Submission must define a top-level .*?\(\) function/);
  assert.match(script, /practiceCommands\.listSubmissions/);
  assert.match(script, /assertNonCompileErrorVerdict/);
  assert.match(script, /expected non-CE terminal verdict/);
  assert.match(script, /assertSingleTerminalResult/);
  assert.match(script, /COUNT\(\*\) FROM judge_results/);
  assert.match(script, /COUNT\(\*\) FROM judge_jobs/);
  assert.match(script, /sourceCode/);
  assert.match(script, /const problemId = 'collapse'/);
  assert.match(script, /def collapse\(number\):/);
  assert.match(script, /for digit in digits:/);
  assert.doesNotMatch(script, /sourceCode:\s*'print\(42\)'/);
  assert.doesNotMatch(script, /smoke-problem-/);
  assert.doesNotMatch(script, /createPublishedSmokeProblem/);
  assert.doesNotMatch(script, /configureSmokeJudge/);
  assert.match(script, /restart compose api service/);
  assert.match(script, /docker', \['compose', '-f', composeFile, 'restart', 'api']/);
  assert.match(script, /await restartLocalApiProcess\(\)/);
  assert.match(script, /fetch persisted data after restart/);
  assert.match(script, /assertNonCompileErrorVerdict\(resultAfterRestart\)/);
  assert.match(script, /assertNoDuplicateWorkerProcessing\(submissionId\)/);
});

test('local smoke submission helper rejects missing configured entryFunction and keeps helper closure', async () => {
  const { assertMissingEntrypointRejected, extractEntrypointPayload } = await importSmokeModule();

  assert.doesNotThrow(() => assertMissingEntrypointRejected('collapse'));
  const extracted = extractEntrypointPayload(`
import math
DEBUG = 999
OFFSET = 2

def helper(value):
    return math.floor(value) + OFFSET

def unused():
    return DEBUG

def collapse():
    return helper(40.8)

print("debug")
`, 'collapse');

  assert.match(extracted, /^import math$/m);
  assert.match(extracted, /^OFFSET = 2$/m);
  assert.match(extracted, /^def helper\(value\):$/m);
  assert.match(extracted, /^def collapse\(\):$/m);
  assert.doesNotMatch(extracted, /^DEBUG = 999$/m);
  assert.doesNotMatch(extracted, /^def unused\(\):$/m);
  assert.doesNotMatch(extracted, /print\("debug"\)/);
});

test('README and local-development doc document the supported local verification workflow', () => {
  const repoRoot = resolveRepoRoot();
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const localDevDoc = fs.readFileSync(path.join(repoRoot, 'docs', 'local-development.md'), 'utf8');

  assert.match(readme, /npm run local:up/);
  assert.match(readme, /npm run local:db:setup/);
  assert.match(readme, /npm run import:problems -- --dir problems/);
  assert.match(readme, /\[Local Development\]\(\.\/docs\/local-development\.md\)/);

  assert.match(localDevDoc, /npm run smoke:local/);
  assert.match(localDevDoc, /npm run extension:package/);
  assert.match(localDevDoc, /Typical verification flow:/);
  assert.match(localDevDoc, /queued -> running -> finished \| failed/);
  assert.match(localDevDoc, /ensure only one worker is active/i);
});
