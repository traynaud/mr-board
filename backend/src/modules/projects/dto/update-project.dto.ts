import { IsIn, IsString, Matches, ValidateIf } from 'class-validator';
import { PROJECT_COLOR_IDS } from '../domain/project-color.js';
import { ALIAS_PATTERN } from './create-project.dto.js';

/**
 * Body of `PUT /api/v1/projects/:id`. Renaming always requires an explicit
 * alias. `color` is always required too (`null` = "Aucune", RG-025-01) — the
 * frontend always sends both fields together on save (RG-025-07).
 */
export class UpdateProjectDto {
  @IsString()
  @Matches(ALIAS_PATTERN)
  alias!: string;

  @ValidateIf((dto: UpdateProjectDto) => dto.color !== null)
  @IsIn(PROJECT_COLOR_IDS)
  color!: string | null;
}
