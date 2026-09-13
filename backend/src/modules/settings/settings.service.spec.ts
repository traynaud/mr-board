import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import {
  BusinessValidationException,
  GitlabAuthException,
  GitlabScopeException,
  MissingConfigurationException,
} from '../../common/exceptions';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { Settings } from './entities/settings.entity';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  const row = (): Settings => ({
    id: 1,
    gitlabUrl: 'https://gitlab.com',
    gitlabTokenEncrypted: null,
    meUsername: null,
    meEmail: null,
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
    updatedAt: '2026-09-01T00:00:00.000Z',
  });
  const repository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const cipher = { encrypt: jest.fn(), decrypt: jest.fn() };
  const gitlab = { getCurrentUser: jest.fn(), getTokenInfo: jest.fn() };
  const user = {
    id: 1,
    username: 'mdupont',
    name: 'Marie Dupont',
    avatar_url: 'https://gitlab.com/a.png',
    web_url: '',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repository.findOneBy.mockResolvedValue(row());
    repository.save.mockImplementation((s: Settings) => Promise.resolve(s));
    repository.create.mockImplementation((s: Settings) => s);
    cipher.encrypt.mockImplementation((v: string) => `enc(${v})`);
    cipher.decrypt.mockImplementation((v: string) =>
      v.startsWith('enc(') ? v.slice(4, -1) : null,
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(Settings), useValue: repository },
        { provide: TokenCipherService, useValue: cipher },
        { provide: GitlabClientService, useValue: gitlab },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  describe('get', () => {
    it('should_return_defaults_without_token', async () => {
      await expect(service.get()).resolves.toEqual({
        gitlabUrl: 'https://gitlab.com',
        tokenConfigured: false,
        tokenHint: null,
        meUsername: null,
        meEmail: null,
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
      });
    });

    it('should_mask_configured_token_with_hint', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabTokenEncrypted: 'enc(glpat-abcdwxyz)',
      });

      const result = await service.get();

      expect(result.tokenConfigured).toBe(true);
      expect(result.tokenHint).toBe('wxyz');
      expect(JSON.stringify(result)).not.toContain('glpat-abcd');
    });

    it('should_report_unreadable_token_as_not_configured', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabTokenEncrypted: 'garbage',
      });

      await expect(service.get()).resolves.toEqual(
        expect.objectContaining({ tokenConfigured: false, tokenHint: null }),
      );
    });

    it('should_recreate_missing_row_with_defaults', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.get();

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, gitlabUrl: 'https://gitlab.com' }),
      );
      expect(result.gitlabUrl).toBe('https://gitlab.com');
    });
  });

  describe('update', () => {
    it('should_normalize_url_and_encrypt_token', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.exemple.fr/',
        gitlabToken: 'glpat-abcdwxyz',
      });

      expect(cipher.encrypt).toHaveBeenCalledWith('glpat-abcdwxyz');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gitlabUrl: 'https://gitlab.exemple.fr',
          gitlabTokenEncrypted: 'enc(glpat-abcdwxyz)',
        }),
      );
      expect(result).toEqual({
        gitlabUrl: 'https://gitlab.exemple.fr',
        tokenConfigured: true,
        tokenHint: 'wxyz',
        meUsername: null,
        meEmail: null,
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
      });
    });

    it('should_keep_existing_token_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabTokenEncrypted: 'enc(old-token-value)',
      });

      const result = await service.update({ gitlabUrl: 'https://new.host' });

      expect(cipher.encrypt).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gitlabUrl: 'https://new.host',
          gitlabTokenEncrypted: 'enc(old-token-value)',
        }),
      );
      expect(result.tokenConfigured).toBe(true);
    });

    it('should_reject_url_without_scheme', async () => {
      await expect(
        service.update({ gitlabUrl: 'gitlab.exemple.fr' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_touch_updated_at', async () => {
      await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.not.stringMatching(/^2026-09-01/) as string,
        }),
      );
    });

    it('should_set_identity_fields_when_provided', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        meUsername: '  mdupont  ',
        meEmail: '  marie@exemple.fr  ',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          meUsername: 'mdupont',
          meEmail: 'marie@exemple.fr',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          meUsername: 'mdupont',
          meEmail: 'marie@exemple.fr',
        }),
      );
    });

    it('should_clear_identity_fields_when_empty_string', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        meUsername: 'kbenali',
        meEmail: 'karim@exemple.fr',
      });

      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        meUsername: '',
        meEmail: '',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ meUsername: null, meEmail: null }),
      );
      expect(result.meUsername).toBeNull();
      expect(result.meEmail).toBeNull();
    });

    it('should_keep_identity_fields_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        meUsername: 'kbenali',
        meEmail: 'karim@exemple.fr',
      });

      const result = await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          meUsername: 'kbenali',
          meEmail: 'karim@exemple.fr',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          meUsername: 'kbenali',
          meEmail: 'karim@exemple.fr',
        }),
      );
    });

    it('should_set_refresh_settings_when_provided', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        refreshIntervalMin: 15,
        pauseWhenHidden: false,
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshIntervalMin: 15,
          pauseWhenHidden: false,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          refreshIntervalMin: 15,
          pauseWhenHidden: false,
        }),
      );
    });

    it('should_keep_refresh_settings_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        refreshIntervalMin: 30,
        pauseWhenHidden: false,
      });

      const result = await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshIntervalMin: 30,
          pauseWhenHidden: false,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          refreshIntervalMin: 30,
          pauseWhenHidden: false,
        }),
      );
    });

    it('should_set_threshold_settings_when_provided', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        easyFiles: 10,
        easyLines: 200,
        hardFiles: 30,
        hardLines: 900,
        readyGreenDays: 2,
        readyOrangeDays: 5,
        workdaysOnly: true,
      });

      expect(repository.save).toHaveBeenCalledWith(
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

    it('should_keep_threshold_settings_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({ ...row(), easyFiles: 8 });

      const result = await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(result).toEqual(expect.objectContaining({ easyFiles: 8 }));
    });

    it('should_reject_hard_files_not_greater_than_easy_files', async () => {
      await expect(
        service.update({
          gitlabUrl: 'https://gitlab.com',
          easyFiles: 5,
          hardFiles: 5,
        }),
      ).rejects.toMatchObject({ code: 'settings.hardFilesTooLow' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_reject_hard_lines_not_greater_than_easy_lines', async () => {
      await expect(
        service.update({
          gitlabUrl: 'https://gitlab.com',
          easyLines: 100,
          hardLines: 50,
        }),
      ).rejects.toMatchObject({ code: 'settings.hardLinesTooLow' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_reject_ready_orange_not_greater_than_ready_green', async () => {
      await expect(
        service.update({
          gitlabUrl: 'https://gitlab.com',
          readyGreenDays: 3,
          readyOrangeDays: 3,
        }),
      ).rejects.toMatchObject({ code: 'settings.readyOrangeTooLow' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_set_the_new_tab_and_ignored_labels_options_when_provided', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        openInNewTab: true,
        ignoredLabels: ['wip', 'on-hold'],
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          openInNewTab: true,
          ignoredLabels: JSON.stringify(['wip', 'on-hold']),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          openInNewTab: true,
          ignoredLabels: ['wip', 'on-hold'],
        }),
      );
    });

    it('should_keep_the_new_tab_and_ignored_labels_options_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        openInNewTab: true,
        ignoredLabels: JSON.stringify(['wip']),
      });

      const result = await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(result).toEqual(
        expect.objectContaining({ openInNewTab: true, ignoredLabels: ['wip'] }),
      );
    });

    it('should_set_the_notification_settings_when_provided', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        notifyAssigned: true,
        tabBadge: true,
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
      );
      expect(result).toEqual(
        expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
      );
    });

    it('should_keep_the_notification_settings_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        notifyAssigned: true,
        tabBadge: true,
      });

      const result = await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(result).toEqual(
        expect.objectContaining({ notifyAssigned: true, tabBadge: true }),
      );
    });

    it('should_set_the_theme_when_provided', async () => {
      const result = await service.update({
        gitlabUrl: 'https://gitlab.com',
        theme: 'dark',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
      expect(result).toEqual(expect.objectContaining({ theme: 'dark' }));
    });

    it('should_keep_the_theme_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue({ ...row(), theme: 'dark' });

      const result = await service.update({ gitlabUrl: 'https://gitlab.com' });

      expect(result).toEqual(expect.objectContaining({ theme: 'dark' }));
    });
  });

  describe('applyImportedSettings', () => {
    it('should_replace_settings_without_touching_the_token', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabTokenEncrypted: 'enc(untouched-token)',
      });

      const result = await service.applyImportedSettings({
        gitlabUrl: 'https://gitlab.exemple.fr/',
        easyFiles: 12,
        openInNewTab: true,
        ignoredLabels: ['wip'],
        notifyAssigned: true,
        tabBadge: true,
        theme: 'dark',
      });

      expect(cipher.encrypt).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gitlabUrl: 'https://gitlab.exemple.fr',
          gitlabTokenEncrypted: 'enc(untouched-token)',
          easyFiles: 12,
          openInNewTab: true,
          ignoredLabels: JSON.stringify(['wip']),
          notifyAssigned: true,
          tabBadge: true,
          theme: 'dark',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          gitlabUrl: 'https://gitlab.exemple.fr',
          tokenConfigured: true,
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
      repository.findOneBy.mockResolvedValue({
        ...row(),
        meUsername: 'kbenali',
      });

      const result = await service.applyImportedSettings({
        gitlabUrl: 'https://gitlab.com',
      });

      expect(result).toEqual(
        expect.objectContaining({ meUsername: 'kbenali' }),
      );
    });

    it('should_reject_an_invalid_url', async () => {
      await expect(
        service.applyImportedSettings({ gitlabUrl: 'not-a-url' }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_reject_incoherent_thresholds', async () => {
      await expect(
        service.applyImportedSettings({
          gitlabUrl: 'https://gitlab.com',
          easyFiles: 5,
          hardFiles: 5,
        }),
      ).rejects.toMatchObject({ code: 'settings.hardFilesTooLow' });
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      gitlab.getCurrentUser.mockResolvedValue(user);
      gitlab.getTokenInfo.mockResolvedValue({
        scopes: ['read_api'],
        expires_at: '2027-03-12',
      });
    });

    it('should_use_body_token_and_return_user_and_expiry', async () => {
      const result = await service.testConnection({
        gitlabUrl: 'https://gitlab.exemple.fr/',
        gitlabToken: 'glpat-body-token',
      });

      expect(gitlab.getCurrentUser).toHaveBeenCalledWith(
        'https://gitlab.exemple.fr',
        'glpat-body-token',
      );
      expect(result).toEqual({
        username: 'mdupont',
        name: 'Marie Dupont',
        avatarUrl: 'https://gitlab.com/a.png',
        expiresAt: '2027-03-12',
        expirationKnown: true,
      });
    });

    it('should_fall_back_to_stored_token', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabTokenEncrypted: 'enc(stored-token-value)',
      });

      await service.testConnection({ gitlabUrl: 'https://gitlab.com' });

      expect(gitlab.getCurrentUser).toHaveBeenCalledWith(
        'https://gitlab.com',
        'stored-token-value',
      );
    });

    it('should_throw_409_when_no_token_available', async () => {
      await expect(
        service.testConnection({ gitlabUrl: 'https://gitlab.com' }),
      ).rejects.toBeInstanceOf(MissingConfigurationException);
      expect(gitlab.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should_succeed_with_unknown_expiration_when_token_info_missing', async () => {
      gitlab.getTokenInfo.mockResolvedValue(null);

      const result = await service.testConnection({
        gitlabUrl: 'https://gitlab.com',
        gitlabToken: 'group-token-value',
      });

      expect(result.expirationKnown).toBe(false);
      expect(result.expiresAt).toBeNull();
    });

    it('should_return_null_expiry_for_non_expiring_token', async () => {
      gitlab.getTokenInfo.mockResolvedValue({
        scopes: ['api'],
        expires_at: null,
      });

      const result = await service.testConnection({
        gitlabUrl: 'https://gitlab.com',
        gitlabToken: 'glpat-body-token',
      });

      expect(result).toEqual(
        expect.objectContaining({ expiresAt: null, expirationKnown: true }),
      );
    });

    it('should_throw_scope_exception_when_read_api_missing', async () => {
      gitlab.getTokenInfo.mockResolvedValue({
        scopes: ['read_user'],
        expires_at: null,
      });

      await expect(
        service.testConnection({
          gitlabUrl: 'https://gitlab.com',
          gitlabToken: 'glpat-body-token',
        }),
      ).rejects.toBeInstanceOf(GitlabScopeException);
    });

    it('should_propagate_client_exceptions', async () => {
      gitlab.getCurrentUser.mockRejectedValue(new GitlabAuthException());

      await expect(
        service.testConnection({
          gitlabUrl: 'https://gitlab.com',
          gitlabToken: 'glpat-body-token',
        }),
      ).rejects.toBeInstanceOf(GitlabAuthException);
    });

    it('should_reject_invalid_url_before_calling_gitlab', async () => {
      await expect(
        service.testConnection({
          gitlabUrl: 'nope',
          gitlabToken: 'glpat-body-token',
        }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
      expect(gitlab.getCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('getters for other modules', () => {
    it('should_expose_url_and_decrypted_token', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabUrl: 'https://gitlab.exemple.fr',
        gitlabTokenEncrypted: 'enc(stored-token-value)',
      });

      await expect(service.getGitlabUrl()).resolves.toBe(
        'https://gitlab.exemple.fr',
      );
      await expect(service.getToken()).resolves.toBe('stored-token-value');
    });

    it('should_return_null_token_when_none', async () => {
      await expect(service.getToken()).resolves.toBeNull();
    });

    it('should_expose_the_configured_identity', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        meUsername: 'mdupont',
        meEmail: 'marie@exemple.fr',
      });

      await expect(service.getIdentity()).resolves.toEqual({
        username: 'mdupont',
        email: 'marie@exemple.fr',
      });
    });

    it('should_expose_a_null_identity_when_not_configured', async () => {
      await expect(service.getIdentity()).resolves.toEqual({
        username: null,
        email: null,
      });
    });

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

    it('should_expose_the_configured_thresholds', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        easyFiles: 10,
        easyLines: 200,
        hardFiles: 30,
        hardLines: 900,
        readyGreenDays: 2,
        readyOrangeDays: 5,
        workdaysOnly: true,
      });

      await expect(service.getThresholds()).resolves.toEqual({
        difficulty: {
          easyFiles: 10,
          easyLines: 200,
          hardFiles: 30,
          hardLines: 900,
        },
        readyDelay: { greenDays: 2, orangeDays: 5 },
        workdaysOnly: true,
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

    it('should_expose_every_exportable_setting_without_the_token', async () => {
      repository.findOneBy.mockResolvedValue({
        ...row(),
        gitlabTokenEncrypted: 'enc(should-not-appear)',
        meUsername: 'mdupont',
        openInNewTab: true,
        ignoredLabels: JSON.stringify(['wip']),
      });

      const result = await service.getExportableSettings();

      expect(result).toEqual({
        gitlabUrl: 'https://gitlab.com',
        meUsername: 'mdupont',
        meEmail: null,
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
      });
      expect(result).not.toHaveProperty('gitlabTokenEncrypted');
      expect(JSON.stringify(result)).not.toContain('should-not-appear');
    });
  });
});
