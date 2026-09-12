import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserNotificationService } from './browser-notification.service';

describe('BrowserNotificationService', () => {
  let service: BrowserNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BrowserNotificationService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isSupported', () => {
    it('should_be_true_when_notification_exists', () => {
      vi.stubGlobal('Notification', class {});

      expect(service.isSupported()).toBe(true);
    });

    it('should_be_false_when_notification_is_absent', () => {
      vi.stubGlobal('Notification', undefined);

      expect(service.isSupported()).toBe(false);
    });
  });

  describe('permission', () => {
    it('should_return_unsupported_when_notification_is_absent', () => {
      vi.stubGlobal('Notification', undefined);

      expect(service.permission()).toBe('unsupported');
    });

    it('should_return_the_current_permission', () => {
      vi.stubGlobal('Notification', { permission: 'granted' });

      expect(service.permission()).toBe('granted');
    });
  });

  describe('requestPermission', () => {
    it('should_return_denied_when_notification_is_absent', async () => {
      vi.stubGlobal('Notification', undefined);

      await expect(service.requestPermission()).resolves.toBe('denied');
    });

    it('should_delegate_to_notification_request_permission', async () => {
      const requestPermission = vi.fn().mockResolvedValue('granted');
      vi.stubGlobal('Notification', { requestPermission });

      await expect(service.requestPermission()).resolves.toBe('granted');
      expect(requestPermission).toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should_do_nothing_when_notification_is_absent', () => {
      vi.stubGlobal('Notification', undefined);

      expect(() => service.show('titre', 'corps', vi.fn())).not.toThrow();
    });

    it('should_do_nothing_when_permission_is_not_granted', () => {
      const NotificationMock = vi.fn();
      vi.stubGlobal('Notification', Object.assign(NotificationMock, { permission: 'denied' }));

      service.show('titre', 'corps', vi.fn());

      expect(NotificationMock).not.toHaveBeenCalled();
    });

    it('should_create_a_notification_and_wire_the_click_handler', () => {
      const onClick = vi.fn();
      const NotificationSpy = vi.fn();
      vi.stubGlobal('Notification', Object.assign(NotificationSpy, { permission: 'granted' }));

      service.show('titre', 'corps', onClick);

      expect(NotificationSpy).toHaveBeenCalledWith('titre', { body: 'corps' });
      const instance = NotificationSpy.mock.instances[0] as { onclick: (() => void) | null };
      instance.onclick?.();
      expect(onClick).toHaveBeenCalled();
    });
  });
});
