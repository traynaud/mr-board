import { Injectable } from '@angular/core';

/**
 * Isole l'API `Notification` du navigateur (RG-016-01/02). Un environnement
 * sans support (ancien navigateur, contexte non sécurisé) répond `false`/
 * `'unsupported'` plutôt que de lever une exception.
 */
@Injectable({ providedIn: 'root' })
export class BrowserNotificationService {
  /** Vrai si l'API `Notification` existe dans cet environnement. */
  isSupported(): boolean {
    return typeof Notification !== 'undefined';
  }

  /** Permission actuelle, ou `'unsupported'` si l'API est absente. */
  permission(): NotificationPermission | 'unsupported' {
    return this.isSupported() ? Notification.permission : 'unsupported';
  }

  /**
   * Demande la permission à l'utilisateur.
   * @returns la permission obtenue, ou `'denied'` si l'API est absente.
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.requestPermission();
  }

  /**
   * Affiche une notification si la permission est accordée ; ne fait rien sinon.
   * @param onClick appelé au clic sur la notification (RG-016-01).
   */
  show(title: string, body: string, onClick: () => void): void {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }
    const notification = new Notification(title, { body });
    notification.onclick = onClick;
  }
}
