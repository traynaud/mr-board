import { HttpStatus } from '@nestjs/common';
import {
  BusinessValidationException,
  EntityNotFoundException,
  GitlabAuthException,
  GitlabUnavailableException,
  MissingConfigurationException,
} from './business.exception';

describe('Business exceptions', () => {
  it.each([
    [new BusinessValidationException('x.y', 'msg'), 400, 'x.y'],
    [new EntityNotFoundException('Mr', 1), 404, 'entity.notFound'],
    [
      new MissingConfigurationException('token.missing', 'm'),
      409,
      'token.missing',
    ],
    [new GitlabAuthException(), 502, 'gitlab.auth'],
    [new GitlabUnavailableException(), 502, 'gitlab.unavailable'],
  ])('should_expose_status_and_code (%#)', (exception, status, code) => {
    expect(exception.getStatus()).toBe(status);
    expect(exception.code).toBe(code);
    expect(exception.getResponse()).toEqual(expect.objectContaining({ code }));
    expect(exception.getResponse()).not.toHaveProperty('error');
    expect(HttpStatus[status]).toBeDefined();
  });
});
