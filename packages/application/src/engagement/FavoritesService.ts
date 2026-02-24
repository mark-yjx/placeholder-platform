export interface FavoritesRepository {
  addFavorite(userId: string, problemId: string): Promise<void>;
  removeFavorite(userId: string, problemId: string): Promise<void>;
  listFavoriteProblemIds(userId: string): Promise<readonly string[]>;
}

export class FavoritesService {
  constructor(private readonly favorites: FavoritesRepository) {}

  async favorite(userId: string, problemId: string): Promise<readonly string[]> {
    await this.favorites.addFavorite(userId, problemId);
    return this.favorites.listFavoriteProblemIds(userId);
  }

  async unfavorite(userId: string, problemId: string): Promise<readonly string[]> {
    await this.favorites.removeFavorite(userId, problemId);
    return this.favorites.listFavoriteProblemIds(userId);
  }

  async list(userId: string): Promise<readonly string[]> {
    return this.favorites.listFavoriteProblemIds(userId);
  }
}

