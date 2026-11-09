import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DismissAllResult,
  NotificationList,
  NotificationSummary,
} from '../../models/notification.model';

/** Accès HTTP aux notifications de l'historique. Appelé uniquement par `NotificationsStore`. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/notifications` — événements non vus et éligibles, du plus récent au plus ancien. */
  getNotifications(): Observable<NotificationList> {
    return this.http.get<NotificationList>('api://notifications');
  }

  /** `GET /api/v1/notifications/summary` — compteur et révision, pour le polling (RG-040-05). */
  getSummary(): Observable<NotificationSummary> {
    return this.http.get<NotificationSummary>('api://notifications/summary');
  }

  /** `POST /api/v1/notifications/:id/dismiss` — marque un événement comme vu (idempotent). */
  postDismiss(id: number): Observable<void> {
    return this.http.post<void>(`api://notifications/${id}/dismiss`, {});
  }

  /** `POST /api/v1/notifications/dismiss-all` — marque tout comme vu (RG-040-02). */
  postDismissAll(): Observable<DismissAllResult> {
    return this.http.post<DismissAllResult>('api://notifications/dismiss-all', {});
  }
}
