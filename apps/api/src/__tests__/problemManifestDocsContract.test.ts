import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'README.md'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for problem manifest docs contract tests');
}

function readText(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

function readJson(...segments: string[]): unknown {
  return JSON.parse(readText(...segments));
}

test('problem manifest spec defines canonical manifest metadata and layer responsibilities', () => {
  const spec = readText('.specify', 'specs', 'problem-manifest.md');

  assert.match(spec, /manifest\.json` as the single source of truth/i);
  assert.match(spec, /problems\/\s*\n\s*<problemId>\//);
  assert.match(spec, /statement\.md/);
  assert.match(spec, /starter\.py/);
  assert.match(spec, /hidden\.json/);
  assert.match(spec, /publicTests/i);

  assert.match(spec, /`problemId`/);
  assert.match(spec, /`title`/);
  assert.match(spec, /`entryFunction`/);
  assert.match(spec, /`language`/);
  assert.match(spec, /`timeLimitMs`/);
  assert.match(spec, /`memoryLimitKb`/);
  assert.match(spec, /`visibility`/);
  assert.match(spec, /`examples`/);
  assert.match(spec, /`difficulty`/);
  assert.match(spec, /`tags`/);
  assert.match(spec, /`version`/);
  assert.match(spec, /`author`/);

  assert.match(spec, /Import Pipeline/);
  assert.match(spec, /Reads `manifest\.json` first/);
  assert.match(spec, /API/);
  assert.match(spec, /Extension/);
  assert.match(spec, /Worker/);
  assert.match(spec, /Database Persistence/);
  assert.match(spec, /Must not assume a fixed `solve\(\)`/);
  assert.match(spec, /Hidden tests must never be exposed to students/);
  assert.match(spec, /queued -> running -> finished \| failed/);
});

test('sample collapse manifest problem folder matches the canonical manifest layout', () => {
  const repoRoot = resolveRepoRoot();
  const problemDir = path.join(repoRoot, 'problems', 'collapse');
  const expectedFiles = ['manifest.json', 'statement.md', 'starter.py', 'hidden.json'];

  for (const fileName of expectedFiles) {
    assert.equal(fs.existsSync(path.join(problemDir, fileName)), true, `${fileName} should exist`);
  }

  const manifest = readJson('problems', 'collapse', 'manifest.json') as {
    problemId: string;
    title: string;
    entryFunction: string;
    language: string;
    timeLimitMs: number;
    memoryLimitKb: number;
    visibility: string;
    examples: Array<{
      input: unknown;
      output: unknown;
    }>;
    publicTests: Array<{
      input: unknown;
      output: unknown;
    }>;
    difficulty?: string;
    tags?: string[];
    version?: string;
    author?: string;
  };
  const statement = readText('problems', 'collapse', 'statement.md');
  const starter = readText('problems', 'collapse', 'starter.py');
  const hiddenTests = readJson('problems', 'collapse', 'hidden.json') as Array<{
    input: unknown;
    expected?: unknown;
    output?: unknown;
  }>;

  assert.equal(manifest.problemId, 'collapse');
  assert.equal(manifest.title, 'Collapse Identical Digits');
  assert.equal(manifest.entryFunction, 'collapse');
  assert.equal(manifest.language, 'python');
  assert.equal(manifest.timeLimitMs, 2000);
  assert.equal(manifest.memoryLimitKb, 65536);
  assert.equal(manifest.visibility, 'public');
  assert.equal(manifest.examples.length > 0, true);
  assert.equal(manifest.publicTests.length > 0, true);
  assert.equal(manifest.difficulty, 'easy');
  assert.deepEqual(manifest.tags, ['digits', 'iteration']);
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.author, 'Placeholder Staff');

  assert.match(statement, /# Collapse Identical Digits/);
  assert.match(starter, /def collapse\(number\):/);
  assert.doesNotMatch(starter, /doctest/);
  assert.equal(hiddenTests.length > 0, true);
});
