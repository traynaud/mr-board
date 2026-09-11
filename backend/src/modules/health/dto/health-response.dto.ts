/** Response of `GET /api/v1/health`. */
export class HealthResponseDto {
  /** Overall status: `ok` when every dependency is up. */
  status!: 'ok' | 'degraded';
  /** Database connectivity. */
  database!: 'up' | 'down';
  /** ISO 8601 timestamp of the check. */
  timestamp!: string;
}
