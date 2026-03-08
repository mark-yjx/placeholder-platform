#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const composeFile = path.join(root, 'deploy', 'local', 'docker-compose.yml');
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3100';

function runPsql(sql) {
  return execFileSync(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'oj',
      '-d',
      'oj',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql
    ],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit']
    }
  ).trim();
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${pathname}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function readCount(sql) {
  return Number.parseInt(runPsql(sql), 10);
}

const loginResponse = await requestJson('/auth/login', {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    email: 'student1@example.com',
    password: 'secret'
  })
});

if (typeof loginResponse.accessToken !== 'string' || loginResponse.accessToken.length === 0) {
  throw new Error('Login verification failed: missing accessToken.');
}

const authorization = {
  authorization: `Bearer ${loginResponse.accessToken}`
};

const problemsResponse = await requestJson('/problems', {
  headers: authorization
});
const favoritesResponse = await requestJson('/favorites', {
  headers: authorization
});
const submissionsResponse = await requestJson('/submissions', {
  headers: authorization
});
const reviewsResponse = await requestJson('/reviews/collapse', {
  headers: authorization
});

const problems = Array.isArray(problemsResponse.problems) ? problemsResponse.problems : [];
if (problems.length !== 1 || problems[0]?.problemId !== 'collapse') {
  throw new Error(`Expected exactly one published problem "collapse", got ${JSON.stringify(problems)}`);
}

if (!Array.isArray(favoritesResponse.favorites)) {
  throw new Error('Favorites API did not return an array.');
}

if (!Array.isArray(submissionsResponse.submissions)) {
  throw new Error('Submissions API did not return an array.');
}

if (!Array.isArray(reviewsResponse.reviews)) {
  throw new Error('Reviews API did not return an array.');
}

const checks = [
  ['problems', "SELECT COUNT(*) FROM problems WHERE id <> 'collapse';"],
  ['problem_versions', "SELECT COUNT(*) FROM problem_versions WHERE problem_id <> 'collapse';"],
  [
    'problem_version_assets',
    `SELECT COUNT(*)
     FROM problem_version_assets
     WHERE problem_version_id IN (
       SELECT id FROM problem_versions WHERE problem_id <> 'collapse'
     );`
  ],
  [
    'problem_version_tests',
    `SELECT COUNT(*)
     FROM problem_version_tests
     WHERE problem_version_id IN (
       SELECT id FROM problem_versions WHERE problem_id <> 'collapse'
     );`
  ],
  ['favorites', "SELECT COUNT(*) FROM favorites WHERE problem_id <> 'collapse';"],
  ['reviews', "SELECT COUNT(*) FROM reviews WHERE problem_id <> 'collapse';"],
  ['submissions', "SELECT COUNT(*) FROM submissions WHERE problem_id <> 'collapse';"],
  ['judge_jobs', "SELECT COUNT(*) FROM judge_jobs WHERE problem_id <> 'collapse';"],
  [
    'judge_results',
    `SELECT COUNT(*)
     FROM judge_results jr
     JOIN submissions s ON s.id = jr.submission_id
     WHERE s.problem_id <> 'collapse';`
  ]
];

for (const [label, sql] of checks) {
  const count = readCount(sql);
  if (count !== 0) {
    throw new Error(`Expected no stale ${label} rows outside collapse, found ${count}.`);
  }
}

console.log(
  `VERIFY PASS: fetchProblems returned collapse only; favorites=${favoritesResponse.favorites.length}; submissions=${submissionsResponse.submissions.length}; reviews=${reviewsResponse.reviews.length}`
);
