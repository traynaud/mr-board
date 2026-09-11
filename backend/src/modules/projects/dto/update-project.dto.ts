import { IsString, Matches } from 'class-validator';
import { ALIAS_PATTERN } from './create-project.dto';

/** Body of `PUT /api/v1/projects/:id`. Renaming always requires an explicit alias. */
export class UpdateProjectDto {
  @IsString()
  @Matches(ALIAS_PATTERN)
  alias!: string;
}
