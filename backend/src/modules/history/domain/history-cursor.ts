/** Position of an event in the timeline order (`occurred_at DESC, id DESC`). */
export interface HistoryCursor {
  occurredAt: string;
  id: number;
}

/** Encodes a cursor as an opaque base64url token (RG-037-03). */
export function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(`${cursor.occurredAt}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

/**
 * Decodes a token produced by {@link encodeCursor}.
 * @returns `null` when the token is not a valid cursor.
 */
export function decodeCursor(token: string): HistoryCursor | null {
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf('|');
  if (separator <= 0) {
    return null;
  }
  const occurredAt = decoded.slice(0, separator);
  const rawId = decoded.slice(separator + 1);
  if (!/^\d+$/.test(rawId) || Number.isNaN(Date.parse(occurredAt))) {
    return null;
  }
  return { occurredAt, id: Number(rawId) };
}
