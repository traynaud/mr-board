import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MergeRequestFilters,
  MergeRequestSort,
  MergeRequestsResponse,
} from '../../models/merge-request.model';

/** Accès HTTP aux MRs synchronisées. Appelé uniquement par `MergeRequestsStore`. */
@Injectable({ providedIn: 'root' })
export class MergeRequestsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/merge-requests?sort=<key>:<direction>&drafts=0|1&mine=0|1` (RG-008-07, RG-009-01/02). */
  getMergeRequests(
    sort: MergeRequestSort,
    filters: MergeRequestFilters,
  ): Observable<MergeRequestsResponse> {
    const params = new HttpParams()
      .set('sort', `${sort.key}:${sort.direction}`)
      .set('drafts', filters.drafts ? '1' : '0')
      .set('mine', filters.mine ? '1' : '0');
    return this.http.get<MergeRequestsResponse>('api://merge-requests', { params });
  }
}
