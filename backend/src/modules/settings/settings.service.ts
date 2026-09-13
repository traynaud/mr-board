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
import type { DifficultyThresholds } from '../merge-requests/domain/calculate-difficulty';
import type { ReadyDelayThresholds } from '../merge-requests/domain/calculate-ready-delay';
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
import type { Language, ThemePreference } from './entities/settings.entity';

/** Fields shared by a full update (`UpdateSettingsDto`) and a config import — never the GitLab token. */
export interface MergeableSettingsFields {
  meUsername?: string;
  meEmail?: string;
  refreshIntervalMin?: number;
  pauseWhenHidden?: boolean;
  easyFiles?: number;
  easyLines?: number;
  hardFiles?: number;
  hardLines?: number;
  readyGreenDays?: number;
  readyOrangeDays?: number;
  workdaysOnly?: boolean;
  openInNewTab?: boolean;
  ignoredLabels?: string[];
  notifyAssigned?: boolean;
  tabBadge?: boolean;
  theme?: ThemePreference;
  highlightMe?: boolean;
  language?: Language;
}

/** Every setting except the GitLab token, as exported/imported by US-015. */
export interface ExportableSettings {
  gitlabUrl: string;
  meUsername: string | null;
  meEmail: string | null;
  refreshIntervalMin: number;
  pauseWhenHidden: boolean;
  easyFiles: number;
  easyLines: number;
  hardFiles: number;
  hardLines: number;
  readyGreenDays: number;
  readyOrangeDays: number;
  workdaysOnly: boolean;
  openInNewTab: boolean;
  ignoredLabels: string[];
  notifyAssigned: boolean;
  tabBadge: boolean;
  theme: ThemePreference;
  highlightMe: boolean;
  language: Language;
}

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
   * Updates the GitLab URL and, when provided, the token (RG-001-01, RG-001-02),
   * identity, refresh cadence and difficulty/Ready delay thresholds (RG-014-01).
   * @throws BusinessValidationException when the URL cannot be normalised, or
   * when the merged thresholds are incoherent (see `requireCoherentThresholds`).
   */
  async update(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const settings = await this.load();
    settings.gitlabUrl = this.requireUrl(dto.gitlabUrl);
    if (dto.gitlabToken !== undefined) {
      settings.gitlabTokenEncrypted = this.cipher.encrypt(dto.gitlabToken);
    }
    this.mergeCommonFields(settings, dto);
    this.requireCoherentThresholds(settings);
    settings.updatedAt = new Date().toISOString();
    return this.toResponse(await this.repository.save(settings));
  }

  /**
   * Replaces every importable setting (RG-015-04) — never the GitLab token,
   * which `ImportSettingsDto` never declares.
   * @throws BusinessValidationException when the URL cannot be normalised, or
   * when the merged thresholds are incoherent.
   */
  async applyImportedSettings(
    dto: { gitlabUrl: string } & MergeableSettingsFields,
  ): Promise<SettingsResponseDto> {
    const settings = await this.load();
    settings.gitlabUrl = this.requireUrl(dto.gitlabUrl);
    this.mergeCommonFields(settings, dto);
    this.requireCoherentThresholds(settings);
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

  /**
   * Scheduled sync cadence in minutes ; `0` = manual (RG-013-01).
   */
  async getRefreshIntervalMin(): Promise<number> {
    return (await this.load()).refreshIntervalMin;
  }

  /**
   * Difficulty and Ready delay thresholds configured by the user (RG-G03,
   * RG-G04, RG-014-01), read fresh on every call so a save takes effect on
   * the very next `GET /merge-requests` (RG-014-04).
   */
  async getThresholds(): Promise<{
    difficulty: DifficultyThresholds;
    readyDelay: ReadyDelayThresholds;
    workdaysOnly: boolean;
  }> {
    const settings = await this.load();
    return {
      difficulty: {
        easyFiles: settings.easyFiles,
        easyLines: settings.easyLines,
        hardFiles: settings.hardFiles,
        hardLines: settings.hardLines,
      },
      readyDelay: {
        greenDays: settings.readyGreenDays,
        orangeDays: settings.readyOrangeDays,
      },
      workdaysOnly: settings.workdaysOnly,
    };
  }

  /**
   * Labels that hide a merge request (RG-015-02), read fresh on every call
   * (same pattern as `getThresholds()`).
   */
  async getIgnoredLabels(): Promise<string[]> {
    const { ignoredLabels } = await this.load();
    return JSON.parse(ignoredLabels) as string[];
  }

  /** Every setting except the GitLab token, for `GET /settings/export` (RG-015-03). */
  async getExportableSettings(): Promise<ExportableSettings> {
    const settings = await this.load();
    return {
      gitlabUrl: settings.gitlabUrl,
      meUsername: settings.meUsername,
      meEmail: settings.meEmail,
      refreshIntervalMin: settings.refreshIntervalMin,
      pauseWhenHidden: settings.pauseWhenHidden,
      easyFiles: settings.easyFiles,
      easyLines: settings.easyLines,
      hardFiles: settings.hardFiles,
      hardLines: settings.hardLines,
      readyGreenDays: settings.readyGreenDays,
      readyOrangeDays: settings.readyOrangeDays,
      workdaysOnly: settings.workdaysOnly,
      openInNewTab: settings.openInNewTab,
      ignoredLabels: JSON.parse(settings.ignoredLabels) as string[],
      notifyAssigned: settings.notifyAssigned,
      tabBadge: settings.tabBadge,
      theme: settings.theme,
      highlightMe: settings.highlightMe,
      language: settings.language,
    };
  }

  /**
   * Merges every field shared by `update()` and `applyImportedSettings()` —
   * everything except `gitlabUrl` (validated separately by each caller) and
   * the GitLab token (never part of an import).
   */
  private mergeCommonFields(
    settings: Settings,
    dto: MergeableSettingsFields,
  ): void {
    if (dto.meUsername !== undefined) {
      settings.meUsername = dto.meUsername.trim() || null;
    }
    if (dto.meEmail !== undefined) {
      settings.meEmail = dto.meEmail.trim() || null;
    }
    if (dto.refreshIntervalMin !== undefined) {
      settings.refreshIntervalMin = dto.refreshIntervalMin;
    }
    if (dto.pauseWhenHidden !== undefined) {
      settings.pauseWhenHidden = dto.pauseWhenHidden;
    }
    if (dto.easyFiles !== undefined) {
      settings.easyFiles = dto.easyFiles;
    }
    if (dto.easyLines !== undefined) {
      settings.easyLines = dto.easyLines;
    }
    if (dto.hardFiles !== undefined) {
      settings.hardFiles = dto.hardFiles;
    }
    if (dto.hardLines !== undefined) {
      settings.hardLines = dto.hardLines;
    }
    if (dto.readyGreenDays !== undefined) {
      settings.readyGreenDays = dto.readyGreenDays;
    }
    if (dto.readyOrangeDays !== undefined) {
      settings.readyOrangeDays = dto.readyOrangeDays;
    }
    if (dto.workdaysOnly !== undefined) {
      settings.workdaysOnly = dto.workdaysOnly;
    }
    if (dto.openInNewTab !== undefined) {
      settings.openInNewTab = dto.openInNewTab;
    }
    if (dto.ignoredLabels !== undefined) {
      settings.ignoredLabels = JSON.stringify(dto.ignoredLabels);
    }
    if (dto.notifyAssigned !== undefined) {
      settings.notifyAssigned = dto.notifyAssigned;
    }
    if (dto.tabBadge !== undefined) {
      settings.tabBadge = dto.tabBadge;
    }
    if (dto.theme !== undefined) {
      settings.theme = dto.theme;
    }
    if (dto.highlightMe !== undefined) {
      settings.highlightMe = dto.highlightMe;
    }
    if (dto.language !== undefined) {
      settings.language = dto.language;
    }
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

  /**
   * Validates the cross-field coherence of the merged threshold values
   * (RG-014-01) : `hardFiles`/`hardLines` must exceed their `easy*`
   * counterpart, `readyOrangeDays` must exceed `readyGreenDays`.
   * @throws BusinessValidationException with a code naming the field in error.
   */
  private requireCoherentThresholds(settings: Settings): void {
    if (settings.hardFiles <= settings.easyFiles) {
      throw new BusinessValidationException(
        'settings.hardFilesTooLow',
        'hardFiles must be greater than easyFiles',
      );
    }
    if (settings.hardLines <= settings.easyLines) {
      throw new BusinessValidationException(
        'settings.hardLinesTooLow',
        'hardLines must be greater than easyLines',
      );
    }
    if (settings.readyOrangeDays <= settings.readyGreenDays) {
      throw new BusinessValidationException(
        'settings.readyOrangeTooLow',
        'readyOrangeDays must be greater than readyGreenDays',
      );
    }
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
      refreshIntervalMin: settings.refreshIntervalMin,
      pauseWhenHidden: settings.pauseWhenHidden,
      easyFiles: settings.easyFiles,
      easyLines: settings.easyLines,
      hardFiles: settings.hardFiles,
      hardLines: settings.hardLines,
      readyGreenDays: settings.readyGreenDays,
      readyOrangeDays: settings.readyOrangeDays,
      workdaysOnly: settings.workdaysOnly,
      openInNewTab: settings.openInNewTab,
      ignoredLabels: JSON.parse(settings.ignoredLabels) as string[],
      notifyAssigned: settings.notifyAssigned,
      tabBadge: settings.tabBadge,
      theme: settings.theme,
      highlightMe: settings.highlightMe,
      language: settings.language,
    };
  }
}
