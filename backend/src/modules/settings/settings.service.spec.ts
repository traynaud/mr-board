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
  });
});
