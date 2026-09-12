import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SyncStatus, SyncTriggerResponse } from '../../models/sync-status.model';

/** Accès HTTP à la synchronisation GitLab. Appelé uniquement par `SyncStore`. */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);

  /**
   * `POST /api/v1/sync`
   * @param projectId quand fourni, ne synchronise que ce repo (RG-004-15).
   */
  postSync(projectId?: number): Observable<SyncTriggerResponse> {
    const url = projectId !== undefined ? `api://sync?projectId=${projectId}` : 'api://sync';
    return this.http.post<SyncTriggerResponse>(url, {});
  }

  /** `GET /api/v1/sync/status` */
  getStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>('api://sync/status');
  }
}
