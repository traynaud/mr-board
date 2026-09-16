/**
 * My identity on a connection, resolved automatically from its token
 * (RG-031-02) — `null` on `ConnectionResponseDto.identity` until a
 * resolution has succeeded at least once.
 */
export class ConnectionIdentityDto {
  username!: string;
  name!: string;
  email!: string | null;
  avatarUrl!: string | null;
}
