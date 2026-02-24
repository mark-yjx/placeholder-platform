import { JudgeCallbackIngestionService } from '@packages/application/src/results/JudgeCallbackIngestionService';
import { Verdict } from '@packages/domain/src/judge';

type JudgeCallbackRequest = {
  submissionId: string;
  verdict: Verdict;
  timeMs: number;
  memoryKb: number;
};

export function createJudgeCallbackRoutes(service: JudgeCallbackIngestionService) {
  return {
    async ingestJudgeCallback(request: JudgeCallbackRequest): Promise<{
      submissionId: string;
      verdict: Verdict;
      timeMs: number;
      memoryKb: number;
    }> {
      return service.ingest(request);
    }
  };
}
