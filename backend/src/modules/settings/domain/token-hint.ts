/** Number of trailing characters revealed to identify a stored token. */
export const TOKEN_HINT_LENGTH = 4;

/**
 * Returns the last characters of a token so the user can recognise it
 * without the API ever exposing the full value (RG-001-03).
 * @param token decrypted token.
 */
export function tokenHint(token: string): string {
  return token.slice(-TOKEN_HINT_LENGTH);
}
