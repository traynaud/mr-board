import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ComposableFilters,
  MergeRequestFilters,
  MergeRequestSort,
  MergeRequestsFacets,
  MergeRequestsResponse,
} from '../../models/merge-request.model';

/** Accès HTTP aux MRs synchronisées. Appelé uniquement par `MergeRequestsStore`. */
@Injectable({ providedIn: 'root' })
export class MergeRequestsService {
  private readonly http = inject(HttpClient);

  /**
   * `GET /api/v1/merge-requests?sort=<key>:<direction>&drafts=0|1&mine=0|1&…`
   * (RG-008-07, RG-009-01/02, RG-010-01).
   */
  getMergeRequests(
    sort: MergeRequestSort,
    filters: MergeRequestFilters,
    composableFilters: ComposableFilters,
  ): Observable<MergeRequestsResponse> {
    const params = filterParams(filters, composableFilters).set(
      'sort',
      `${sort.key}:${sort.direction}`,
    );
    return this.http.get<MergeRequestsResponse>('api://merge-requests', { params });
  }

  /** `GET /api/v1/merge-requests/facets?drafts=0|1&mine=0|1&…` (RG-010-07), mêmes filtres sans `sort`. */
  getFacets(
    filters: MergeRequestFilters,
    composableFilters: ComposableFilters,
  ): Observable<MergeRequestsFacets> {
    const params = filterParams(filters, composableFilters);
    return this.http.get<MergeRequestsFacets>('api://merge-requests/facets', { params });
  }

  /** `PUT`/`DELETE /api/v1/merge-requests/:id/favorite` (RG-027-08). */
  setFavorite(id: number, favorite: boolean): Observable<void> {
    return favorite
      ? this.http.put<void>(`api://merge-requests/${id}/favorite`, {})
      : this.http.delete<void>(`api://merge-requests/${id}/favorite`);
  }
}

/** Query params partagés par `getMergeRequests` et `getFacets` (RG-010-01/12). */
function filterParams(
  filters: MergeRequestFilters,
  composableFilters: ComposableFilters,
): HttpParams {
  let params = new HttpParams()
    .set('drafts', filters.drafts ? '1' : '0')
    .set('mine', filters.mine ? '1' : '0')
    .set('fav', filters.favorites ? '1' : '0');
  if (composableFilters.connection.length > 0) {
    params = params.set('connection', composableFilters.connection.join(','));
  }
  if (composableFilters.project.length > 0) {
    params = params.set('project', composableFilters.project.join(','));
  }
  if (composableFilters.author.length > 0) {
    params = params.set('author', composableFilters.author.join(','));
  }
  if (composableFilters.assigned.length > 0) {
    params = params.set('assigned', composableFilters.assigned.join(','));
  }
  if (composableFilters.label.length > 0) {
    params = params.set('label', composableFilters.label.join(','));
  }
  if (composableFilters.approved !== null) {
    params = params.set('approved', composableFilters.approved === 'yes' ? '1' : '0');
  }
  if (composableFilters.commented !== null) {
    params = params.set('commented', composableFilters.commented === 'yes' ? '1' : '0');
  }
  if (filters.search !== '') {
    params = params.set('q', filters.search);
  }
  return params;
}
