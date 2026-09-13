import { Language, ThemePreference } from '../entities/settings.entity';

/**
 * Response of `GET|PUT /api/v1/settings` — global preferences only
 * (RG-019-23). Per-connection identity is exposed by `GET /connections`
 * (`meUsername` there), not here.
 */
export class SettingsResponseDto {
  /** Fallback email for role matching (RG-002-01, RG-G09, RG-019-07). */
  meEmail!: string | null;
  /** Scheduled sync cadence in minutes ; `0` = manual (RG-013-01). */
  refreshIntervalMin!: number;
  /** Suspend frontend polling/reload while the tab is hidden (RG-013-05). */
  pauseWhenHidden!: boolean;
  /** Difficulty thresholds (RG-G03, RG-014-01). */
  easyFiles!: number;
  easyLines!: number;
  hardFiles!: number;
  hardLines!: number;
  /** Ready delay thresholds in days (RG-G04, RG-014-01). */
  readyGreenDays!: number;
  readyOrangeDays!: number;
  /** Count only Monday-Friday for the Ready delay (RG-G04, RG-014-01). */
  workdaysOnly!: boolean;
  /** Open MR titles in a new tab (RG-G11, RG-015-01). */
  openInNewTab!: boolean;
  /** Labels that hide a merge request, compared case-insensitively (RG-015-02). */
  ignoredLabels!: string[];
  /** Browser notification when a merge request is newly assigned to me (RG-016-01/02). */
  notifyAssigned!: boolean;
  /** Tab title badge counting red Ready-level merge requests (RG-016-04). */
  tabBadge!: boolean;
  /** Theme preference (RG-018-01) : `system` follows the OS, `light`/`dark` force it. */
  theme!: ThemePreference;
  /** Highlight my avatar (author/reviewer/assignee) in the merge requests table (RG-023-01). */
  highlightMe!: boolean;
  /** UI language preference (RG-022-01). */
  language!: Language;
}
