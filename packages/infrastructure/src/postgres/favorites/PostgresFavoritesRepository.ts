import { FavoritesRepository } from '@packages/application/src/engagement';

export interface PostgresFavoritesSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

const INSERT_FAVORITE_SQL = `
INSERT INTO favorites (user_id, problem_id)
VALUES ($1, $2)
ON CONFLICT (user_id, problem_id) DO NOTHING
`;

const DELETE_FAVORITE_SQL = `
DELETE FROM favorites
WHERE user_id = $1
  AND problem_id = $2
`;

const LIST_FAVORITES_SQL = `
SELECT problem_id
FROM favorites
WHERE user_id = $1
ORDER BY problem_id ASC
`;

type FavoriteRow = {
  problem_id: string;
};

export class PostgresFavoritesRepository implements FavoritesRepository {
  constructor(private readonly client: PostgresFavoritesSqlClient) {}

  async addFavorite(userId: string, problemId: string): Promise<void> {
    await this.client.execute(INSERT_FAVORITE_SQL, [userId, problemId]);
  }

  async removeFavorite(userId: string, problemId: string): Promise<void> {
    await this.client.execute(DELETE_FAVORITE_SQL, [userId, problemId]);
  }

  async listFavoriteProblemIds(userId: string): Promise<readonly string[]> {
    const rows = await this.client.query<FavoriteRow>(LIST_FAVORITES_SQL, [userId]);
    return rows.map((row) => row.problem_id);
  }
}

