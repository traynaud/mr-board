import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for domain exceptions. Carries a stable machine-readable `code`
 * that the frontend maps to an i18n key.
 */
export class BusinessException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}

/** A business rule was violated (400). */
export class BusinessValidationException extends BusinessException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.BAD_REQUEST);
  }
}

/** The requested entity does not exist (404). */
export class EntityNotFoundException extends BusinessException {
  constructor(entity: string, id: string | number) {
    super('entity.notFound', `${entity} ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

/** A required configuration item is missing (409). */
export class MissingConfigurationException extends BusinessException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.CONFLICT);
  }
}

/** The forge rejected the token (502). */
export class ForgeAuthException extends BusinessException {
  constructor(message = 'The forge rejected the token') {
    super('forge.auth', message, HttpStatus.BAD_GATEWAY);
  }
}

/** The token lacks the scope required to read merge/pull requests (400). */
export class ForgeScopeException extends BusinessValidationException {
  constructor(message = 'Token requires the read_api scope') {
    super('forge.scope', message);
  }
}

/** The forge is unreachable or returned a server error (502). */
export class ForgeUnavailableException extends BusinessException {
  constructor(message = 'The forge is unavailable') {
    super('forge.unavailable', message, HttpStatus.BAD_GATEWAY);
  }
}

/** A forge request exceeded its allotted time budget (502). See RG-004-14. */
export class ForgeTimeoutException extends BusinessException {
  constructor(message = 'Forge request timed out') {
    super('forge.timeout', message, HttpStatus.BAD_GATEWAY);
  }
}

/**
 * The forge's rate limit was hit while testing a connection (502). See
 * RG-020-03. Distinct from `ForgeUnavailableException` because it names a
 * specific, actionable cause ("try again later") rather than a generic
 * outage — thrown only by `testConnection` (a mid-sync rate limit is
 * retried once then falls back to `ForgeUnavailableException`, RG-020-11).
 */
export class ForgeRateLimitedException extends BusinessException {
  constructor(message = 'The forge rate limit was reached') {
    super('forge.rateLimited', message, HttpStatus.BAD_GATEWAY);
  }
}

/** A connection name is already used by another connection (400). See RG-019-02. */
export class ConnectionNameDuplicateException extends BusinessValidationException {
  constructor(message = 'This connection name is already used') {
    super('connections.nameDuplicate', message);
  }
}

/** No connection is configured yet (409). See RG-019-15. */
export class ConnectionMissingException extends BusinessException {
  constructor(message = 'No connection configured') {
    super('connections.missing', message, HttpStatus.CONFLICT);
  }
}

/** The targeted connection has no token configured (409). See RG-019-15. */
export class ConnectionTokenMissingException extends BusinessException {
  constructor(message = 'No token configured for this connection') {
    super('connections.tokenMissing', message, HttpStatus.CONFLICT);
  }
}
