export type JudgeVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';

export type PublishedProblem = {
  problemId: string;
  title: string;
};

export type CreateSubmissionRequest = {
  problemId: string;
  language: 'python';
  sourceCode: string;
};

export type CreateSubmissionResponse = {
  submissionId: string;
};

export type SubmissionResult = {
  submissionId: string;
  verdict: JudgeVerdict;
  timeMs: number;
  memoryKb: number;
};

export interface PracticeApiClient {
  listPublishedProblems(accessToken: string): Promise<readonly PublishedProblem[]>;
  createSubmission(
    accessToken: string,
    request: CreateSubmissionRequest
  ): Promise<CreateSubmissionResponse>;
  getSubmissionResult(accessToken: string, submissionId: string): Promise<SubmissionResult>;
}
