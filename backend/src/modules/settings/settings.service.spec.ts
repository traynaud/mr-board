import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Settings } from './entities/settings.entity.js';
import { SettingsService } from './settings.service.js';

describe('SettingsService', () => {
  let service: SettingsService;
  const row = (): Settings => ({
    id: 1,
    refreshIntervalMin: 5,
    pauseWhenHidden: true,
    easyFiles: 5,
    easyLines: 100,
    hardFiles: 20,
    hardLines: 800,
    readyGreenDays: 1,
    readyOrangeDays: 3,
    workdaysOnly: false,
    openInNewTab: false,
    ignoredLabels: '[]',
    notifyAssigned: false,
    tabBadge: false,
    theme: 'system',
    highlightMe: true,
    language: 'fr',
    updatedAt: '2026-09-01T00:00:00.000Z',
  });
  const repository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repository.findOneBy.mockResolvedValue(row());
    repository.save.mockImplementation((s: Settings) => Promise.resolve(s));
    repository.create.mockImplementation((s: Settings) => s);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(Settings), useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  describe('get', () => {
    it('should_return_defaults', async () => {
      await expect(service.get()).resolves.toEqual({
        refreshIntervalMin: 5,
        pauseWhenHidden: true,
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
        readyGreenDays: 1,
        readyOrangeDays: 3,
        workdaysOnly: false,
        openInNewTab: false,
        ignoredLabels: [],
        notifyAssigned: false,
        tabBadge: false,
        theme: 'system',
        highlightMe: true,
        language: 'fr',
      });
    });

    it('should_recreate_missing_row_with_defaults', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.get();

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, theme: 'system' }),
      );
      expect(result.theme).toBe('system');
    });
  });

  describe('update', () => {
    it('should_touch_updated_at', async () => {
      await service.update({});

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.not.stringMatching(/^2026-09-01/) as string,
        }),
      );
    });

    it('should_set_refresh_settings_when_provided', async () => {
      const result = await service.update({
        refreshIntervalMin: 15,
        pauseWhenHidden: false,
      });

      expect(result).toEqual(
        expect.objectContaining({
          refreshIntervalMin: 15,
          pauseWhenHidden: false,
        }),
      );
    });

    it('should_set_threshold_settings_when_provided', async () => {
      const result = await service.update({
        easyFiles: 10,
        easyLines: 200,
        hardFiles: 30,
        hardLines: 900,
        readyGreenDays: 2,
        readyOrangeDays: 5,
        workdaysOnly: true,
      });

      expect(result).toEqual(
        expect.objectContaining({
          easyFiles: 10,
          easyLines: 200,
          hardFiles: 30,
          hardLines: 900,
          readyGreenDays: 2,
          readyOrangeDays: 5,
          workdaysOnly: true,
        }),
      );
    });

    it('should_reject_hard_files_not_greater_than_easy_files', async () => {
      await expect(
        service.update({ easyFiles: 5, hardFiles: 5 }),
      ).rejects.toMatchObject({ code: 'settings.hardFilesTooLow' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_reject_hard_lines_not_greater_than_easy_lines', async () => {
      await expect(
        service.update({ easyLines: 100, hardLines: 50 }),
      ).rejects.toMatchObject({ code: 'settings.hardLinesTooLow' });
    });

    it('should_reject_ready_orange_not_greater_than_ready_green', async () => {
      await expect(
        service.update({ readyGreenDays: 3, readyOrangeDays: 3 }),
      ).rejects.toMatchObject({ code: 'settings.readyOrangeTooLow' });
    });

    it('should_set_the_new_tab_and_ignored_labels_options_when_provided', async () => {
      const result = await service.update({
        openInNewTab: true,
        ignoredLabels: ['wip', 'on-hold'],
      });

      expect(result).toEqual(
        expect.objectContaining({
          openInNewTab: true,
          ignoredLabels: ['wip', 'on-hold'],
        }),
      );
    });

    it('should_set_the_notification_settings_when_provided', async () => {
      const result = await service.update({
        notifyAssigned: true,
        tabBadge: true,
      });

      expect(result).toEqual(
        expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
      );
    });

    it('should_set_the_theme_when_provided', async () => {
      const result = await service.update({ theme: 'dark' });

      expect(result).toEqual(expect.objectContaining({ theme: 'dark' }));
    });

    it('should_set_highlight_me_when_provided', async () => {
      const result = await service.update({ highlightMe: false });

      expect(result).toEqual(expect.objectContaining({ highlightMe: false }));
    });

    it('should_set_the_language_when_provided', async () => {
      const result = await service.update({ language: 'en' });

      expect(result).toEqual(expect.objectContaining({ language: 'en' }));
    });
  });

  describe('applyImportedSettings', () => {
    it('should_replace_every_given_preference', async () => {
      const result = await service.applyImportedSettings({
        easyFiles: 12,
        openInNewTab: true,
        ignoredLabels: ['wip'],
        notifyAssigned: true,
        tabBadge: true,
        theme: 'dark',
      });

      expect(result).toEqual(
        expect.objectContaining({
          easyFiles: 12,
          openInNewTab: true,
          ignoredLabels: ['wip'],
          notifyAssigned: true,
          tabBadge: true,
          theme: 'dark',
        }),
      );
    });

    it('should_keep_omitted_fields_unchanged', async () => {
      repository.findOneBy.mockResolvedValue({ ...row(), theme: 'dark' });

      const result = await service.applyImportedSettings({});

      expect(result).toEqual(expect.objectContaining({ theme: 'dark' }));
    });

    it('should_reject_incoherent_thresholds', async () => {
      await expect(
        service.applyImportedSettings({ easyFiles: 5, hardFiles: 5 }),
      ).rejects.toMatchObject({ code: 'settings.hardFilesTooLow' });
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getters for other modules', () => {
    it('should_expose_the_configured_refresh_interval', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        refreshIntervalMin: 15,
      });

      await expect(service.getRefreshIntervalMin()).resolves.toBe(15);
    });

    it('should_default_the_refresh_interval_to_five_minutes', async () => {
      await expect(service.getRefreshIntervalMin()).resolves.toBe(5);
    });

    it('should_expose_the_default_thresholds', async () => {
      await expect(service.getThresholds()).resolves.toEqual({
        difficulty: {
          easyFiles: 5,
          easyLines: 100,
          hardFiles: 20,
          hardLines: 800,
        },
        readyDelay: { greenDays: 1, orangeDays: 3 },
        workdaysOnly: false,
      });
    });

    it('should_default_ignored_labels_to_an_empty_array', async () => {
      await expect(service.getIgnoredLabels()).resolves.toEqual([]);
    });

    it('should_expose_the_configured_ignored_labels', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        ignoredLabels: JSON.stringify(['wip', 'on-hold']),
      });

      await expect(service.getIgnoredLabels()).resolves.toEqual([
        'wip',
        'on-hold',
      ]);
    });

    it('should_expose_every_exportable_setting', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        openInNewTab: true,
        ignoredLabels: JSON.stringify(['wip']),
      });

      const result = await service.getExportableSettings();

      expect(result).toEqual({
        refreshIntervalMin: 5,
        pauseWhenHidden: true,
        easyFiles: 5,
        easyLines: 100,
        hardFiles: 20,
        hardLines: 800,
        readyGreenDays: 1,
        readyOrangeDays: 3,
        workdaysOnly: false,
        openInNewTab: true,
        ignoredLabels: ['wip'],
        notifyAssigned: false,
        tabBadge: false,
        theme: 'system',
        highlightMe: true,
        language: 'fr',
      });
    });
  });
});
