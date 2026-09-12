/** One selectable option of a facet, with its contextual count (RG-010-07/08). */
export class FacetOptionDto {
  value!: string;
  label!: string;
  count!: number;
}

/** Response of `GET /api/v1/merge-requests/facets` (RG-010-07). */
export class MergeRequestsFacetsDto {
  project!: FacetOptionDto[];
  author!: FacetOptionDto[];
  /** `'nobody'` is always the first entry (RG-010-05). */
  assigned!: FacetOptionDto[];
  /** Two entries, `value: 'yes'|'no'` (see archi.md for the chosen shape). */
  approved!: FacetOptionDto[];
  commented!: FacetOptionDto[];
}
