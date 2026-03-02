export type JudgeVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';
export type SubmissionStatus = 'queued' | 'running' | 'finished' | 'failed';

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
  status: SubmissionStatus;
  verdict?: JudgeVerdict;
  timeMs?: number;
  memoryKb?: number;
};

export interface PracticeApiClient {
  listPublishedProblems(accessToken: string): Promise<readonly PublishedProblem[]>;
  listSubmissions(accessToken: string): Promise<readonly SubmissionResult[]>;
  createSubmission(
    accessToken: string,
    request: CreateSubmissionRequest
  ): Promise<CreateSubmissionResponse>;
  getSubmissionResult(accessToken: string, submissionId: string): Promise<SubmissionResult>;
}
