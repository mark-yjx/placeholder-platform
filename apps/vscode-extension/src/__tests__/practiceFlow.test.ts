import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateSubmissionRequest,
  JudgeVerdict,
  ProblemDetail,
  PracticeApiClient,
  PublishedProblem,
  SubmissionResult
} from '../api/PracticeApiClient';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { PracticeCommands } from '../practice/PracticeCommands';

class FakeAuthClient implements AuthClient {
  async login(): Promise<{ accessToken: string }> {
    return { accessToken: 'student-token' };
  }
}

class FakePracticeApiClient implements PracticeApiClient {
  private submissionCounter = 0;
  private readonly problems: readonly PublishedProblem[] = [
    { problemId: 'p1', title: 'Two Sum' },
    { problemId: 'p2', title: 'FizzBuzz' }
  ];
  private readonly resultsById = new Map<string, SubmissionResult>();

  constructor(private readonly verdictSequence: readonly JudgeVerdict[]) {}

  async listPublishedProblems(): Promise<readonly PublishedProblem[]> {
    return this.problems;
  }

  async getPublishedProblemDetail(
    _accessToken: string,
    problemId: string
  ): Promise<ProblemDetail> {
    return {
      problemId,
      versionId: `${problemId}-v1`,
      title: this.problems.find((problem) => problem.problemId === problemId)?.title ?? 'Unknown Problem',
      statement: 'Solve it',
      starterCode: 'def solve():\n    # YOUR CODE HERE\n    raise NotImplementedError\n'
    };
  }

  async listSubmissions(): Promise<readonly SubmissionResult[]> {
    return Array.from(this.resultsById.values());
  }

  async createSubmission(
    _accessToken: string,
    request: CreateSubmissionRequest
  ): Promise<{ submissionId: string }> {
    this.submissionCounter += 1;
    const submissionId = `sub-${this.submissionCounter}`;
    const verdict = this.verdictSequence[this.submissionCounter - 1] ?? 'AC';
    this.resultsById.set(submissionId, {
      submissionId,
      status: 'finished',
      verdict,
      timeMs: 100 + this.submissionCounter,
      memoryKb: 2048 + this.submissionCounter
    });

    assert.ok(request.problemId.length > 0);
    assert.equal(request.language, 'python');
    assert.ok(request.sourceCode.length > 0);

    return { submissionId };
  }

  async getSubmissionResult(_accessToken: string, submissionId: string): Promise<SubmissionResult> {
    const result = this.resultsById.get(submissionId);
    if (!result) {
      throw new Error('Submission not found');
    }
    return result;
  }
}

test('user can complete fetch -> submit -> see AC/WA/TLE/RE/CE + time/memory', async () => {
  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new FakeAuthClient(), tokenStore);
  const practiceCommands = new PracticeCommands(
    new FakePracticeApiClient(['AC', 'WA', 'TLE', 'RE', 'CE']),
    tokenStore
  );

  await authCommands.login({ email: 'student@example.com', password: 'secret' });

  const problems = await practiceCommands.fetchPublishedProblems();
  assert.ok(problems.length > 0);

  for (const expectedVerdict of ['AC', 'WA', 'TLE', 'RE', 'CE'] as const) {
    const submission = await practiceCommands.submitCode({
      problemId: problems[0]!.problemId,
      language: 'python',
      sourceCode: 'print(42)'
    });

    const rendered = await practiceCommands.viewSubmissionResult(submission.submissionId);
    assert.match(rendered, new RegExp(`^${expectedVerdict} \\| time: \\d+ms \\| memory: \\d+KB$`));
  }
});

test('view submission result handles running state without verdict metrics', async () => {
  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new FakeAuthClient(), tokenStore);

  class RunningPracticeApiClient extends FakePracticeApiClient {
    override async getSubmissionResult(): Promise<SubmissionResult> {
      return {
        submissionId: 'sub-running-1',
        status: 'running'
      };
    }
  }

  const practiceCommands = new PracticeCommands(
    new RunningPracticeApiClient(['AC']),
    tokenStore
  );

  await authCommands.login({ email: 'student@example.com', password: 'secret' });

  assert.equal(
    await practiceCommands.viewSubmissionResult('sub-running-1'),
    'RUNNING | waiting for judge result'
  );
});
