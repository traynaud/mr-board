import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { TokenCipherService } from '../../common/crypto/token-cipher.service.js';
import {
  BusinessValidationException,
  ConnectionMissingException,
  ConnectionNameDuplicateException,
  ConnectionTokenMissingException,
  EntityNotFoundException,
} from '../../common/exceptions/index.js';
import { ForgeClientFactory } from '../forges/forge-client.factory.js';
import { Project } from '../projects/entities/project.entity.js';
import { ConnectionsService } from './connections.service.js';
import { Connection } from './entities/connection.entity.js';

describe('ConnectionsService', () => {
  let service: ConnectionsService;
  const row = (overrides: Partial<Connection> = {}): Connection => ({
    id: 1,
    type: 'gitlab',
    name: 'gitlab.com',
    url: 'https://gitlab.com',
    tokenEncrypted: 'enc(glpat-token-value)',
    resolvedUsername: null,
    resolvedName: null,
    resolvedEmail: null,
    resolvedAvatarUrl: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });
  const repository = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };
  const projects = { count: jest.fn() };
  const cipher = { encrypt: jest.fn(), decrypt: jest.fn() };
  const gitlabForge = {
    normalizeUrl: jest.fn(),
    testConnection: jest.fn(),
  };
  const githubForge = {
    normalizeUrl: jest.fn(),
    testConnection: jest.fn(),
  };
  const forges = { forType: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository.find.mockResolvedValue([]);
    repository.findBy.mockResolvedValue([]);
    repository.findOneBy.mockResolvedValue(null);
    repository.save.mockImplementation((c: Connection) => Promise.resolve(c));
    repository.create.mockImplementation(
      (c: Partial<Connection>) => ({ id: 1, ...c }) as Connection,
    );
    repository.count.mockResolvedValue(0);
    projects.count.mockResolvedValue(0);
    cipher.encrypt.mockImplementation((plain: string) => `enc(${plain})`);
    cipher.decrypt.mockImplementation((payload: string) =>
      payload.startsWith('enc(') ? payload.slice(4, -1) : null,
    );
    gitlabForge.normalizeUrl.mockImplementation((url: string) =>
      url.startsWith('http') ? url.replace(/\/+$/, '') : null,
    );
    gitlabForge.testConnection.mockResolvedValue({
      username: 'mdupont',
      name: 'Marie Dupont',
      email: 'marie.dupont@exemple.fr',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: false,
      scopeKnown: false,
    });
    githubForge.normalizeUrl.mockImplementation((url: string) =>
      url.startsWith('http') ? url.replace(/\/+$/, '') : null,
    );
    forges.forType.mockImplementation((type: string) =>
      type === 'github' ? githubForge : gitlabForge,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: getRepositoryToken(Connection), useValue: repository },
        { provide: getRepositoryToken(Project), useValue: projects },
        { provide: TokenCipherService, useValue: cipher },
        { provide: ForgeClientFactory, useValue: forges },
      ],
    }).compile();
    service = moduleRef.get(ConnectionsService);
  });

  describe('list', () => {
    it('should_return_connections_with_their_project_count', async () => {
      repository.find.mockResolvedValue([row()]);
      projects.count.mockResolvedValue(3);

      await expect(service.list()).resolves.toEqual([
        {
          id: 1,
          type: 'gitlab',
          name: 'gitlab.com',
          url: 'https://gitlab.com',
          tokenConfigured: true,
          tokenHint: 'alue',
          identity: null,
          projectsCount: 3,
        },
      ]);
    });

    it('should_expose_the_resolved_identity_when_one_has_succeeded', async () => {
      repository.find.mockResolvedValue([
        row({
          resolvedUsername: 'mdupont',
          resolvedName: 'Marie Dupont',
          resolvedEmail: 'marie.dupont@exemple.fr',
          resolvedAvatarUrl: 'https://gitlab.com/mdupont.png',
        }),
      ]);

      const [connection] = await service.list();

      expect(connection.identity).toEqual({
        username: 'mdupont',
        name: 'Marie Dupont',
        email: 'marie.dupont@exemple.fr',
        avatarUrl: 'https://gitlab.com/mdupont.png',
      });
    });

    it('should_fall_back_to_the_username_as_the_display_name_when_unresolved', async () => {
      repository.find.mockResolvedValue([
        row({ resolvedUsername: 'mdupont', resolvedName: null }),
      ]);

      const [connection] = await service.list();

      expect(connection.identity).toEqual(
        expect.objectContaining({ username: 'mdupont', name: 'mdupont' }),
      );
    });
  });

  describe('add', () => {
    it('should_store_a_gitlab_connection_with_an_encrypted_token', async () => {
      const result = await service.add({
        type: 'gitlab',
        name: 'gitlab.com',
        url: 'https://gitlab.com/',
        token: 'glpat-abcdwxyz',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'gitlab',
          name: 'gitlab.com',
          url: 'https://gitlab.com',
          tokenEncrypted: 'enc(glpat-abcdwxyz)',
        }),
      );
      expect(result.tokenConfigured).toBe(true);
    });

    it('should_store_a_github_connection_with_an_encrypted_token', async () => {
      const result = await service.add({
        type: 'github',
        name: 'github.com',
        url: 'https://github.com/',
        token: 'ghp-abcdwxyz',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'github',
          name: 'github.com',
          url: 'https://github.com',
          tokenEncrypted: 'enc(ghp-abcdwxyz)',
        }),
      );
      expect(result.tokenConfigured).toBe(true);
    });

    it('should_reject_an_unnormalisable_url', async () => {
      await expect(
        service.add({
          type: 'gitlab',
          name: 'x',
          url: 'not a url',
          token: 'glpat-abcdwxyz',
        }),
      ).rejects.toBeInstanceOf(BusinessValidationException);
    });

    it('should_reject_a_duplicate_name_case_insensitively', async () => {
      repository.find.mockResolvedValue([row({ name: 'gitlab.com' })]);

      await expect(
        service.add({
          type: 'gitlab',
          name: 'GITLAB.COM',
          url: 'https://gitlab.com',
          token: 'glpat-abcdwxyz',
        }),
      ).rejects.toBeInstanceOf(ConnectionNameDuplicateException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_start_with_no_resolved_identity_and_resolve_it_in_the_background', async () => {
      // RG-031-03 : la réponse HTTP ne l'attend pas...
      const result = await service.add({
        type: 'gitlab',
        name: 'gitlab.com',
        url: 'https://gitlab.com/',
        token: 'glpat-abcdwxyz',
      });

      expect(result.identity).toBeNull();
      // ...mais l'appel forge, lui, part bien immédiatement (fire-and-forget).
      expect(gitlabForge.testConnection).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-abcdwxyz',
      );
    });
  });

  describe('update', () => {
    it('should_keep_the_token_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue(row());

      const result = await service.update(1, {
        url: 'https://gitlab.exemple.fr',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenEncrypted: 'enc(glpat-token-value)' }),
      );
      expect(result.tokenConfigured).toBe(true);
    });

    it('should_replace_the_token_when_given', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await service.update(1, { token: 'glpat-new-token-wxyz' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenEncrypted: 'enc(glpat-new-token-wxyz)',
        }),
      );
    });

    it('should_resolve_the_identity_in_the_background_when_the_token_changes', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await service.update(1, { token: 'glpat-new-token-wxyz' });

      expect(gitlabForge.testConnection).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-new-token-wxyz',
      );
    });

    it('should_not_resolve_the_identity_when_only_the_name_or_url_changes', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await service.update(1, { url: 'https://gitlab.exemple.fr' });

      expect(gitlabForge.testConnection).not.toHaveBeenCalled();
    });

    it('should_throw_404_for_an_unknown_id', async () => {
      await expect(service.update(99, {})).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should_reject_a_duplicate_name_excluding_itself', async () => {
      repository.findOneBy.mockResolvedValue(row({ id: 2, name: 'web' }));
      repository.find.mockResolvedValue([
        row({ id: 2, name: 'web' }),
        row({ id: 1, name: 'gitlab.com' }),
      ]);

      await expect(
        service.update(2, { name: 'gitlab.com' }),
      ).rejects.toBeInstanceOf(ConnectionNameDuplicateException);
    });

    it('should_treat_a_null_name_url_or_token_as_absent_rather_than_throw', async () => {
      // `@IsOptional()` lets `null` through DTO validation (it only skips the
      // other validators) — must not crash on `.trim()`/`normalizeUrl`/
      // `encrypt`, same pitfall as `SettingsService.mergeCommonFields`.
      repository.findOneBy.mockResolvedValue(row());

      const result = await service.update(1, {
        name: null as unknown as string,
        url: null as unknown as string,
        token: null as unknown as string,
      });

      expect(result.name).toBe('gitlab.com');
      expect(result.url).toBe('https://gitlab.com');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenEncrypted: 'enc(glpat-token-value)' }),
      );
    });
  });

  describe('remove', () => {
    it('should_remove_an_existing_connection', async () => {
      const connection = row();
      repository.findOneBy.mockResolvedValue(connection);

      await service.remove(1);

      expect(repository.remove).toHaveBeenCalledWith(connection);
    });

    it('should_throw_404_for_an_unknown_id', async () => {
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('test', () => {
    it('should_test_with_the_submitted_values', async () => {
      await service.test({
        type: 'gitlab',
        url: 'https://gitlab.com',
        token: 'glpat-abcdwxyz',
      });

      expect(gitlabForge.testConnection).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-abcdwxyz',
      );
    });

    it('should_test_the_stored_connection_with_its_own_token_when_omitted', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await service.test({ connectionId: 1 });

      expect(gitlabForge.testConnection).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-token-value',
      );
    });

    it('should_throw_when_neither_connectionId_nor_type_and_url_are_given', async () => {
      await expect(service.test({})).rejects.toBeInstanceOf(
        BusinessValidationException,
      );
    });

    it('should_throw_token_missing_when_the_stored_connection_has_no_token', async () => {
      repository.findOneBy.mockResolvedValue(row({ tokenEncrypted: null }));

      await expect(service.test({ connectionId: 1 })).rejects.toBeInstanceOf(
        ConnectionTokenMissingException,
      );
    });

    it('should_persist_the_resolved_identity_on_a_successful_test_of_a_stored_connection', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await service.test({ connectionId: 1 });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedUsername: 'mdupont',
          resolvedName: 'Marie Dupont',
          resolvedEmail: 'marie.dupont@exemple.fr',
        }),
      );
    });

    it('should_not_persist_anything_when_testing_ad_hoc_values_without_a_stored_connection', async () => {
      await service.test({
        type: 'gitlab',
        url: 'https://gitlab.com',
        token: 'glpat-abcdwxyz',
      });

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getToken', () => {
    it('should_return_the_decrypted_token', async () => {
      repository.findOneBy.mockResolvedValue(row());

      await expect(service.getToken(1)).resolves.toBe('glpat-token-value');
    });

    it('should_return_null_when_no_token_is_configured', async () => {
      repository.findOneBy.mockResolvedValue(row({ tokenEncrypted: null }));

      await expect(service.getToken(1)).resolves.toBeNull();
    });
  });

  describe('resolveIdentity', () => {
    it('should_persist_the_forge_result_on_success', async () => {
      const connection = row();

      await service.resolveIdentity(connection);

      expect(gitlabForge.testConnection).toHaveBeenCalledWith(
        'https://gitlab.com',
        'glpat-token-value',
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedUsername: 'mdupont',
          resolvedName: 'Marie Dupont',
          resolvedEmail: 'marie.dupont@exemple.fr',
          resolvedAvatarUrl: null,
        }),
      );
    });

    it('should_do_nothing_when_no_token_is_configured', async () => {
      const connection = row({ tokenEncrypted: null });

      await service.resolveIdentity(connection);

      expect(gitlabForge.testConnection).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should_keep_the_previous_identity_when_the_forge_call_fails', async () => {
      gitlabForge.testConnection.mockRejectedValue(new Error('unauthorized'));
      const connection = row({ resolvedUsername: 'mdupont' });

      await expect(
        service.resolveIdentity(connection),
      ).resolves.toBeUndefined();

      expect(repository.save).not.toHaveBeenCalled();
      expect(connection.resolvedUsername).toBe('mdupont');
    });

    it('should_do_nothing_when_the_stored_token_cannot_be_decrypted', async () => {
      cipher.decrypt.mockReturnValue(null);
      const connection = row();

      await service.resolveIdentity(connection);

      expect(gitlabForge.testConnection).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByIds', () => {
    it('should_return_matching_entities', async () => {
      repository.findBy.mockResolvedValue([row()]);

      await expect(service.findByIds([1])).resolves.toEqual([row()]);
      expect(repository.findBy).toHaveBeenCalledWith({ id: In([1]) });
    });

    it('should_not_query_when_the_id_list_is_empty', async () => {
      await expect(service.findByIds([])).resolves.toEqual([]);
      expect(repository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('importUpsert', () => {
    it('should_update_the_url_of_an_existing_connection_without_touching_its_token_or_identity', async () => {
      repository.find.mockResolvedValue([
        row({ name: 'GitLab', resolvedUsername: 'mdupont' }),
      ]);

      const result = await service.importUpsert({
        type: 'gitlab',
        name: 'GITLAB',
        url: 'https://gitlab.exemple.fr',
      });

      expect(result).toEqual({ name: 'GitLab', created: false });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://gitlab.exemple.fr',
          resolvedUsername: 'mdupont',
          tokenEncrypted: 'enc(glpat-token-value)',
        }),
      );
    });

    it('should_create_a_new_connection_without_a_token_or_a_resolved_identity_when_no_match_exists', async () => {
      const result = await service.importUpsert({
        type: 'gitlab',
        name: 'gitlab.exemple.fr',
        url: 'https://gitlab.exemple.fr',
      });

      expect(result).toEqual({ name: 'gitlab.exemple.fr', created: true });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenEncrypted: null,
          resolvedUsername: null,
        }),
      );
    });
  });

  describe('requireAny', () => {
    it('should_throw_when_no_connection_exists', async () => {
      repository.count.mockResolvedValue(0);

      await expect(service.requireAny()).rejects.toBeInstanceOf(
        ConnectionMissingException,
      );
    });

    it('should_resolve_when_at_least_one_connection_exists', async () => {
      repository.count.mockResolvedValue(1);

      await expect(service.requireAny()).resolves.toBeUndefined();
    });
  });
});
