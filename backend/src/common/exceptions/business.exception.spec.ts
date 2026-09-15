import { HttpStatus } from '@nestjs/common';
import {
  BusinessValidationException,
  ConnectionMissingException,
  ConnectionNameDuplicateException,
  ConnectionTokenMissingException,
  EntityNotFoundException,
  ForgeAuthException,
  ForgeRateLimitedException,
  ForgeScopeException,
  ForgeTimeoutException,
  ForgeUnavailableException,
  MissingConfigurationException,
} from './business.exception.js';

describe('Business exceptions', () => {
  it.each([
    [new BusinessValidationException('x.y', 'msg'), 400, 'x.y'],
    [new EntityNotFoundException('Mr', 1), 404, 'entity.notFound'],
    [
      new MissingConfigurationException('token.missing', 'm'),
      409,
      'token.missing',
    ],
    [new ForgeAuthException(), 502, 'forge.auth'],
    [new ForgeScopeException(), 400, 'forge.scope'],
    [new ForgeUnavailableException(), 502, 'forge.unavailable'],
    [new ForgeTimeoutException(), 502, 'forge.timeout'],
    [new ForgeRateLimitedException(), 502, 'forge.rateLimited'],
    [new ConnectionNameDuplicateException(), 400, 'connections.nameDuplicate'],
    [new ConnectionMissingException(), 409, 'connections.missing'],
    [new ConnectionTokenMissingException(), 409, 'connections.tokenMissing'],
  ])('should_expose_status_and_code (%#)', (exception, status, code) => {
    expect(exception.getStatus()).toBe(status);
    expect(exception.code).toBe(code);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ code }));
    expect(exception.getResponse()).not.toHaveProperty('error');
    expect(HttpStatus[status]).toBeDefined();
  });
});
