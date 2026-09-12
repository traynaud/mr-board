/**
 * Whether a merge request carries at least one of the configured ignored
 * labels (RG-015-02), comparison case-insensitive. `rawLabelsJson` is the
 * `MergeRequest.labels` column, a JSON-encoded `string[]`.
 */
export function isIgnoredByLabel(
  rawLabelsJson: string,
  ignoredLabels: string[],
): boolean {
  if (ignoredLabels.length === 0) {
    return false;
  }
  const labels = JSON.parse(rawLabelsJson) as string[];
  const ignored = new Set(ignoredLabels.map((label) => label.toLowerCase()));
  return labels.some((label) => ignored.has(label.toLowerCase()));
}
