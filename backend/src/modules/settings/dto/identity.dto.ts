import { IsInt, IsString } from 'class-validator';

/** One entry of `UpdateSettingsDto.identities` (RG-019-08). */
export class IdentityDto {
  @IsInt()
  connectionId!: number;

  /** Trimmed and stored; empty clears the username on that connection. */
  @IsString()
  username!: string;
}
