export type JudgeVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';
export type SubmissionStatus = 'queued' | 'running' | 'finished' | 'failed';

export type PublishedProblem = {
  problemId: string;
  title: string;
  statement?: string;
};

export type ProblemDetail = PublishedProblem & {
  versionId: string;
  starterCode?: string;
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
  status: SubmissionStatus;
  failureReason?: string;
  verdict?: JudgeVerdict;
  timeMs?: number;
  memoryKb?: number;
};

export interface PracticeApiClient {
  listPublishedProblems(accessToken: string): Promise<readonly PublishedProblem[]>;
  getPublishedProblemDetail(accessToken: string, problemId: string): Promise<ProblemDetail>;
  listSubmissions(accessToken: string): Promise<readonly SubmissionResult[]>;
  createSubmission(
    accessToken: string,
    request: CreateSubmissionRequest
  ): Promise<CreateSubmissionResponse>;
  getSubmissionResult(accessToken: string, submissionId: string): Promise<SubmissionResult>;
}
