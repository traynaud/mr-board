import { HistoryEvent } from '../../models/history.model';

/** Événements d'une même journée locale. */
export interface DayGroup {
  /** Jour local au format `YYYY-MM-DD`. */
  day: string;
  events: HistoryEvent[];
}

/** Jour local (`YYYY-MM-DD`) d'un instant ISO, dans le fuseau du navigateur (RG-007-04). */
export function localDayOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Regroupe des événements déjà triés (récent → ancien) par jour local, en
 * conservant l'ordre (RG-037-01).
 */
export function groupByDay(events: readonly HistoryEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const day = localDayOf(event.occurredAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) {
      last.events.push(event);
    } else {
      groups.push({ day, events: [event] });
    }
  }
  return groups;
}
