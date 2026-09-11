/**
 * Erreur API normalisée côté frontend, construite par `httpErrorInterceptor`
 * à partir du payload du backend (`{ statusCode, error, message, code? }`).
 */
export class ApiError extends Error {
  constructor(
    /** Code HTTP (0 si le serveur est injoignable). */
    readonly status: number,
    /** Code métier stable renvoyé par le backend, si présent. */
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Clé i18n à afficher pour cette erreur. */
  get i18nKey(): string {
    if (this.status === 0) {
      return 'errors.network';
    }
    return this.code ? `errors.${this.code}` : 'errors.unexpected';
  }
}

/** Clé i18n d'une erreur quelconque remontée par la couche HTTP, pour les stores. */
export function errorKeyOf(error: unknown): string {
  return error instanceof ApiError ? error.i18nKey : 'errors.unexpected';
}
