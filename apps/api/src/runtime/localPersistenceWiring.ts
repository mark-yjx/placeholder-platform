import {
  FavoritesService,
  ProblemAdminCrudService,
  ProblemPublicationService,
  ProblemVersionHistoryQueryService,
  ReviewsService,
  StudentProblemQueryService
} from '@packages/application/src';
import {
  InMemoryProblemRepository,
  PostgresFavoritesRepository,
  PostgresProblemRepository,
  PostgresReviewsRepository
} from '@packages/infrastructure/src';
import type { PostgresSqlClient } from '@packages/infrastructure/src/postgres/problem';
import type { PostgresFavoritesSqlClient } from '@packages/infrastructure/src/postgres/favorites';
import type { PostgresReviewsSqlClient } from '@packages/infrastructure/src/postgres/reviews';

export type PersistenceMode = 'in-memory' | 'postgres';

export type PersistenceSqlClients = {
  problemClient?: PostgresSqlClient;
  favoritesClient?: PostgresFavoritesSqlClient;
  reviewsClient?: PostgresReviewsSqlClient;
};

export type LocalPersistenceServices = {
  problemAdmin: ProblemAdminCrudService;
  problemPublication: ProblemPublicationService;
  studentProblemQuery: StudentProblemQueryService;
  problemVersionHistory: ProblemVersionHistoryQueryService;
  favorites: FavoritesService;
  reviews: ReviewsService;
};

function requirePostgresClient<T>(client: T | undefined, name: string): T {
  if (!client) {
    throw new Error(`Missing Postgres SQL client for ${name}`);
  }
  return client;
}

export function createLocalPersistenceServices(options: {
  mode?: PersistenceMode;
  runtimeEnv?: string;
  sqlClients?: PersistenceSqlClients;
}): LocalPersistenceServices {
  const runtimeEnv = options.runtimeEnv ?? process.env.NODE_ENV ?? 'development';
  const mode = options.mode ?? (runtimeEnv === 'local' ? 'postgres' : 'in-memory');

  if (mode === 'postgres') {
    const sqlClients = options.sqlClients ?? {};
    const problems = new PostgresProblemRepository(
      requirePostgresClient(sqlClients.problemClient, 'problems')
    );
    const favorites = new PostgresFavoritesRepository(
      requirePostgresClient(sqlClients.favoritesClient, 'favorites')
    );
    const reviews = new PostgresReviewsRepository(
      requirePostgresClient(sqlClients.reviewsClient, 'reviews')
    );

    return {
      problemAdmin: new ProblemAdminCrudService(problems),
      problemPublication: new ProblemPublicationService(problems),
      studentProblemQuery: new StudentProblemQueryService(problems),
      problemVersionHistory: new ProblemVersionHistoryQueryService(problems),
      favorites: new FavoritesService(favorites),
      reviews: new ReviewsService(reviews)
    };
  }

  throw new Error(
    'In-memory local persistence wiring for favorites/reviews is not supported in Phase 3 runtime mode'
  );
}

export function createDefaultLocalProblemRepository(options: {
  mode?: PersistenceMode;
  runtimeEnv?: string;
  sqlClients?: PersistenceSqlClients;
}) {
  const runtimeEnv = options.runtimeEnv ?? process.env.NODE_ENV ?? 'development';
  const mode = options.mode ?? (runtimeEnv === 'local' ? 'postgres' : 'in-memory');

  if (mode === 'postgres') {
    const problemClient = requirePostgresClient(options.sqlClients?.problemClient, 'problems');
    return new PostgresProblemRepository(problemClient);
  }

  return new InMemoryProblemRepository();
}

