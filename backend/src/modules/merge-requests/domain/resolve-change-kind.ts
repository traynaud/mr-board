/** How a merge request changed since it was last seen (US-043, RG-043-01). */
export type ChangeKind = 'new' | 'modified';

/**
 * Resolves the highlight kind of a merge request from the types of its
 * **unseen** journal events (RG-043-01): any `created` makes it `new`
 * (it wins over later modifications), any other event makes it `modified`,
 * no event means no highlight.
 * @param unseenTypes event types of the merge request that are not seen yet.
 */
export function resolveChangeKind(
  unseenTypes: readonly string[],
): ChangeKind | null {
  if (unseenTypes.length === 0) {
    return null;
  }
  return unseenTypes.includes('created') ? 'new' : 'modified';
}
