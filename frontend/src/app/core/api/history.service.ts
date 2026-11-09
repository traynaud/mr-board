import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HistoryResponse } from '../../models/history.model';

/** Accès HTTP à l'historique des MRs. Appelé uniquement par `HistoryStore`. */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);

  /**
   * `GET /api/v1/history?limit=<n>&cursor=<opaque>` (RG-037-03).
   * @param cursor `nextCursor` de la page précédente, absent pour la première page.
   * @param limit taille de page (défaut serveur : 50).
   */
  getHistory(cursor: string | null, limit?: number): Observable<HistoryResponse> {
    let params = new HttpParams();
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryResponse>('api://history', { params });
  }
}
