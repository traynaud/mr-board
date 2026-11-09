import { HistoryEvent } from './history.model';

/** Réponse de `GET /notifications/summary` : compteur et jeton de révision (RG-040-05). */
export interface NotificationSummary {
  /** Événements éligibles non vus (exact, jamais plafonné). */
  count: number;
  /** Change dès que le contenu du panneau change, y compris la confirmation d'un provisoire. */
  revision: string;
}

/** Réponse de `GET /notifications` : les 50 plus récents + compteur exact (RG-040-07). */
export interface NotificationList extends NotificationSummary {
  events: HistoryEvent[];
}

/** Réponse de `POST /notifications/dismiss-all`. */
export interface DismissAllResult {
  dismissed: number;
}
