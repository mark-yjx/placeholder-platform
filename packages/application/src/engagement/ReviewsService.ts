export type ReviewSentiment = 'like' | 'dislike';

export type ProblemReview = {
  userId: string;
  problemId: string;
  sentiment: ReviewSentiment;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export interface ReviewsRepository {
  upsertReview(input: {
    userId: string;
    problemId: string;
    sentiment: ReviewSentiment;
    content: string;
  }): Promise<void>;
  deleteOwnReview(userId: string, problemId: string): Promise<void>;
  listReviews(problemId: string): Promise<readonly ProblemReview[]>;
}

export class ReviewsService {
  constructor(private readonly reviews: ReviewsRepository) {}

  async submitReview(input: {
    userId: string;
    problemId: string;
    sentiment: ReviewSentiment;
    content: string;
  }): Promise<readonly ProblemReview[]> {
    await this.reviews.upsertReview(input);
    return this.reviews.listReviews(input.problemId);
  }

  async deleteOwnReview(userId: string, problemId: string): Promise<readonly ProblemReview[]> {
    await this.reviews.deleteOwnReview(userId, problemId);
    return this.reviews.listReviews(problemId);
  }

  async listReviews(problemId: string): Promise<readonly ProblemReview[]> {
    return this.reviews.listReviews(problemId);
  }
}

