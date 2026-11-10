import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HistoryActorOption, HistoryFilters, HistoryResponse } from '../../models/history.model';

/** Début du jour local `day` (`AAAA-MM-JJ`), en instant ISO. */
function startOfLocalDay(day: string, offsetDays = 0): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date + offsetDays).toISOString();
}

/**
 * Filtres → paramètres de `GET /history` (RG-038-09) : la période en jours locaux devient
 * `from` (début du premier jour, inclus) et `to` (début du lendemain du dernier jour, exclu).
 */
export function historyFilterParams(filters: HistoryFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search.trim() !== '') {
    params['q'] = filters.search.trim();
  }
  if (filters.types.length > 0) {
    params['type'] = filters.types.join(',');
  }
  if (filters.actors.length > 0) {
    params['actor'] = filters.actors.join(',');
  }
  if (filters.projects.length > 0) {
    params['project'] = filters.projects.join(',');
  }
  if (filters.from !== null) {
    params['from'] = startOfLocalDay(filters.from);
  }
  if (filters.to !== null) {
    params['to'] = startOfLocalDay(filters.to, 1);
  }
  return params;
}

/** Accès HTTP à l'historique des MRs. Appelé uniquement par `HistoryStore`. */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);

  /**
   * `GET /api/v1/history?limit=<n>&cursor=<opaque>&q&type&actor&project&from&to` (RG-037-03, RG-038-*).
   * @param cursor `nextCursor` de la page précédente, absent pour la première page.
   * @param limit taille de page (défaut serveur : 50).
   * @param filters filtres à appliquer côté serveur (aucun par défaut).
   */
  getHistory(
    cursor: string | null,
    limit?: number,
    filters?: HistoryFilters,
  ): Observable<HistoryResponse> {
    let params = new HttpParams({ fromObject: filters ? historyFilterParams(filters) : {} });
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryResponse>('api://history', { params });
  }

  /** `GET /api/v1/history/actors` : acteurs distincts de l'historique (RG-038-07). */
  getActors(): Observable<HistoryActorOption[]> {
    return this.http.get<HistoryActorOption[]>('api://history/actors');
  }
}
