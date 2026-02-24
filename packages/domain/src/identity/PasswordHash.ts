export class PasswordHash {
  private constructor(private readonly value: string) {}

  static create(raw: string): PasswordHash {
    const normalized = raw.trim();
    if (normalized.length < 20) {
      throw new Error('Invalid password hash');
    }
    return new PasswordHash(normalized);
  }

  toString(): string {
    return this.value;
  }
}
