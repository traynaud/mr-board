import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MergeRequestSort, MergeRequestView } from '../../models/merge-request.model';

/** Accès HTTP aux MRs synchronisées. Appelé uniquement par `MergeRequestsStore`. */
@Injectable({ providedIn: 'root' })
export class MergeRequestsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/merge-requests?sort=<key>:<direction>` (RG-008-07). */
  getMergeRequests(sort: MergeRequestSort): Observable<MergeRequestView[]> {
    const params = new HttpParams().set('sort', `${sort.key}:${sort.direction}`);
    return this.http.get<MergeRequestView[]>('api://merge-requests', { params });
  }
}
