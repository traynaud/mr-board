import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessValidationException } from '../../common/exceptions/index.js';
import type { DifficultyThresholds } from '../merge-requests/domain/calculate-difficulty.js';
import type { ReadyDelayThresholds } from '../merge-requests/domain/calculate-ready-delay.js';
import { SettingsResponseDto } from './dto/settings-response.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SETTINGS_ID, Settings } from './entities/settings.entity.js';
import type { Language, ThemePreference } from './entities/settings.entity.js';

/** Fields shared by a full update (`UpdateSettingsDto`) and a config import. */
export interface MergeableSettingsFields {
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

/** Every global preference, as exported/imported by US-015 (RG-019-23). */
export interface ExportableSettings {
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

/** Manages the global application preferences singleton (RG-019-23). */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Settings)
    private readonly repository: Repository<Settings>,
  ) {}

  /** Current settings. */
  async get(): Promise<SettingsResponseDto> {
    return this.toResponse(await this.load());
  }

  /**
   * Updates the global preferences (RG-014-01).
   * @throws BusinessValidationException when the merged thresholds are incoherent.
   */
  async update(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const settings = await this.load();
    this.mergeCommonFields(settings, dto);
    this.requireCoherentThresholds(settings);
    settings.updatedAt = new Date().toISOString();
    const saved = await this.repository.save(settings);
    return this.toResponse(saved);
  }

  /**
   * Replaces every importable preference (RG-015-04, RG-019-23) — never the
   * identities, which follow the connections import instead (RG-019-19).
   * @throws BusinessValidationException when the merged thresholds are incoherent.
   */
  async applyImportedSettings(
    dto: MergeableSettingsFields,
  ): Promise<SettingsResponseDto> {
    const settings = await this.load();
    this.mergeCommonFields(settings, dto);
    this.requireCoherentThresholds(settings);
    settings.updatedAt = new Date().toISOString();
    return this.toResponse(await this.repository.save(settings));
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

  /** Every global preference, for `GET /settings/export` (RG-015-03, RG-019-23). */
  async getExportableSettings(): Promise<ExportableSettings> {
    const settings = await this.load();
    return {
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
   * Merges every field shared by `update()` and `applyImportedSettings()`.
   */
  private mergeCommonFields(
    settings: Settings,
    dto: MergeableSettingsFields,
  ): void {
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
    return {
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
