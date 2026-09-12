import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MergeRequestView } from '../../models/merge-request.model';

/** Accès HTTP aux MRs synchronisées. Appelé uniquement par `MergeRequestsStore`. */
@Injectable({ providedIn: 'root' })
export class MergeRequestsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/merge-requests` */
  getMergeRequests(): Observable<MergeRequestView[]> {
    return this.http.get<MergeRequestView[]>('api://merge-requests');
  }
}
