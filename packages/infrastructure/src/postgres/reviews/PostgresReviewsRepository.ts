import { ProblemReview, ReviewsRepository, ReviewSentiment } from '@placeholder/application/src/engagement';

export interface PostgresReviewsSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

const UPSERT_REVIEW_SQL = `
INSERT INTO reviews (user_id, problem_id, sentiment, content)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, problem_id) DO UPDATE
SET sentiment = EXCLUDED.sentiment,
    content = EXCLUDED.content,
    updated_at = NOW()
`;

const DELETE_OWN_REVIEW_SQL = `
DELETE FROM reviews
WHERE user_id = $1
  AND problem_id = $2
`;

const LIST_REVIEWS_SQL = `
SELECT
  user_id,
  problem_id,
  sentiment,
  content,
  created_at,
  updated_at
FROM reviews
WHERE problem_id = $1
ORDER BY updated_at DESC, user_id ASC
`;

type ReviewRow = {
  user_id: string;
  problem_id: string;
  sentiment: string;
  content: string;
  created_at: string;
  updated_at: string;
};

function parseSentiment(value: string): ReviewSentiment {
  if (value === 'like' || value === 'dislike') {
    return value;
  }
  throw new Error(`Unsupported review sentiment: ${value}`);
}

export class PostgresReviewsRepository implements ReviewsRepository {
  constructor(private readonly client: PostgresReviewsSqlClient) {}

  async upsertReview(input: {
    userId: string;
    problemId: string;
    sentiment: ReviewSentiment;
    content: string;
  }): Promise<void> {
    await this.client.execute(UPSERT_REVIEW_SQL, [
      input.userId,
      input.problemId,
      input.sentiment,
      input.content
    ]);
  }

  async deleteOwnReview(userId: string, problemId: string): Promise<void> {
    await this.client.execute(DELETE_OWN_REVIEW_SQL, [userId, problemId]);
  }

  async listReviews(problemId: string): Promise<readonly ProblemReview[]> {
    const rows = await this.client.query<ReviewRow>(LIST_REVIEWS_SQL, [problemId]);
    return rows.map((row) => ({
      userId: row.user_id,
      problemId: row.problem_id,
      sentiment: parseSentiment(row.sentiment),
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

