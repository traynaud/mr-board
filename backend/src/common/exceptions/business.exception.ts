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

/** GitLab rejected the token (502). */
export class GitlabAuthException extends BusinessException {
  constructor(message = 'GitLab rejected the token') {
    super('gitlab.auth', message, HttpStatus.BAD_GATEWAY);
  }
}

/** The GitLab token lacks the `read_api` scope (400). */
export class GitlabScopeException extends BusinessValidationException {
  constructor(message = 'GitLab token requires the read_api scope') {
    super('gitlab.scope', message);
  }
}

/** GitLab is unreachable or returned a server error (502). */
export class GitlabUnavailableException extends BusinessException {
  constructor(message = 'GitLab is unavailable') {
    super('gitlab.unavailable', message, HttpStatus.BAD_GATEWAY);
  }
}
