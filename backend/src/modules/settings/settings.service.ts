import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import {
  BusinessValidationException,
  GitlabScopeException,
  MissingConfigurationException,
} from '../../common/exceptions';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { hasRequiredScope } from './domain/check-token-scopes';
import { normalizeGitlabUrl } from './domain/normalize-gitlab-url';
import { tokenHint } from './domain/token-hint';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { TestConnectionResultDto } from './dto/test-connection-result.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_GITLAB_URL,
  SETTINGS_ID,
  Settings,
} from './entities/settings.entity';

/** Manages the settings singleton and the GitLab connection test. */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Settings)
    private readonly repository: Repository<Settings>,
    private readonly cipher: TokenCipherService,
    private readonly gitlab: GitlabClientService,
  ) {}

  /**
   * Current settings, token masked.
   */
  async get(): Promise<SettingsResponseDto> {
    return this.toResponse(await this.load());
  }

  /**
   * Updates the GitLab URL and, when provided, the token (RG-001-01, RG-001-02).
   * @throws BusinessValidationException when the URL cannot be normalised.
   */
  async update(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const settings = await this.load();
    settings.gitlabUrl = this.requireUrl(dto.gitlabUrl);
    if (dto.gitlabToken !== undefined) {
      settings.gitlabTokenEncrypted = this.cipher.encrypt(dto.gitlabToken);
    }
    if (dto.meUsername !== undefined) {
      settings.meUsername = dto.meUsername.trim() || null;
    }
    if (dto.meEmail !== undefined) {
      settings.meEmail = dto.meEmail.trim() || null;
    }
    settings.updatedAt = new Date().toISOString();
    return this.toResponse(await this.repository.save(settings));
  }

  /**
   * Verifies a token against GitLab (RG-001-04). Uses the body token when
   * given, otherwise the stored one.
   * @throws MissingConfigurationException when no token is available (409).
   * @throws GitlabScopeException when the token lacks `read_api` (400).
   * @throws GitlabAuthException / GitlabUnavailableException from the client (502).
   */
  async testConnection(
    dto: TestConnectionDto,
  ): Promise<TestConnectionResultDto> {
    const url = this.requireUrl(dto.gitlabUrl);
    const token = dto.gitlabToken ?? (await this.getToken());
    if (!token) {
      throw new MissingConfigurationException(
        'settings.tokenMissing',
        'No GitLab token provided or configured',
      );
    }
    const user = await this.gitlab.getCurrentUser(url, token);
    const info = await this.gitlab.getTokenInfo(url, token);
    if (info && !hasRequiredScope(info.scopes)) {
      throw new GitlabScopeException();
    }
    return {
      username: user.username,
      name: user.name,
      avatarUrl: user.avatar_url ?? null,
      expiresAt: info?.expires_at ?? null,
      expirationKnown: info !== null,
    };
  }

  /**
   * Configured GitLab instance URL.
   */
  async getGitlabUrl(): Promise<string> {
    return (await this.load()).gitlabUrl;
  }

  /**
   * Current "me" identity, used for role matching (RG-G09, US-009).
   * `null` fields mean the identity is not configured.
   */
  async getIdentity(): Promise<{
    username: string | null;
    email: string | null;
  }> {
    const { meUsername, meEmail } = await this.load();
    return { username: meUsername, email: meEmail };
  }

  /**
   * Decrypted GitLab token for server-side use only.
   * @returns `null` when not configured or unreadable (RG-001-10).
   */
  async getToken(): Promise<string | null> {
    const { gitlabTokenEncrypted } = await this.load();
    return gitlabTokenEncrypted
      ? this.cipher.decrypt(gitlabTokenEncrypted)
      : null;
  }

  private async load(): Promise<Settings> {
    const existing = await this.repository.findOneBy({ id: SETTINGS_ID });
    if (existing) {
      return existing;
    }
    this.logger.warn('Settings row missing, recreating defaults');
    return this.repository.save(
      this.repository.create({
        id: SETTINGS_ID,
        gitlabUrl: DEFAULT_GITLAB_URL,
        gitlabTokenEncrypted: null,
        meUsername: null,
        meEmail: null,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  private requireUrl(raw: string): string {
    const url = normalizeGitlabUrl(raw);
    if (!url) {
      throw new BusinessValidationException(
        'settings.invalidUrl',
        'gitlabUrl must be an http(s) origin',
      );
    }
    return url;
  }

  private toResponse(settings: Settings): SettingsResponseDto {
    const token = settings.gitlabTokenEncrypted
      ? this.cipher.decrypt(settings.gitlabTokenEncrypted)
      : null;
    return {
      gitlabUrl: settings.gitlabUrl,
      tokenConfigured: token !== null,
      tokenHint: token ? tokenHint(token) : null,
      meUsername: settings.meUsername,
      meEmail: settings.meEmail,
    };
  }
}
