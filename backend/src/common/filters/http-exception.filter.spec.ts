import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { EntityNotFoundException } from '../exceptions';
import { ErrorResponse, HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const json = jest.fn<void, [ErrorResponse]>();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/test', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    filter = new HttpExceptionFilter();
  });

  it('should_map_business_exception_with_code', () => {
    filter.catch(new EntityNotFoundException('Project', 7), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'NOT_FOUND',
        code: 'entity.notFound',
        message: 'Project 7 not found',
        path: '/api/v1/test',
      }),
    );
  });

  it('should_keep_validation_messages_array', () => {
    filter.catch(new BadRequestException(['alias must be a string']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['alias must be a string'],
      }),
    );
    expect(json.mock.calls[0][0]).not.toHaveProperty('code');
  });

  it('should_map_string_response_exception', () => {
    const body = HttpExceptionFilter.toBody(
      new BadRequestException('plain'),
      '/x',
    );

    expect(body.message).toBe('plain');
    expect(body.error).toBe('Bad Request');
  });

  it('should_hide_unexpected_errors_and_log_them', () => {
    filter.catch(new Error('boom: secret detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('secret');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('should_stringify_non_error_throwables', () => {
    filter.catch('oops', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('500'),
      'oops',
    );
  });
});
