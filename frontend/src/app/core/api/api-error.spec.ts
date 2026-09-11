import { ApiError, errorKeyOf } from './api-error';

describe('ApiError', () => {
  it('should_build_network_key_for_status_zero', () => {
    expect(new ApiError(0, undefined, 'down').i18nKey).toBe('errors.network');
  });

  it('should_build_key_from_code_when_present', () => {
    expect(new ApiError(404, 'entity.notFound', 'x').i18nKey).toBe('errors.entity.notFound');
  });

  it('should_fallback_to_unexpected_without_code', () => {
    expect(new ApiError(500, undefined, 'x').i18nKey).toBe('errors.unexpected');
  });
});

describe('errorKeyOf', () => {
  it('should_read_i18nKey_from_an_ApiError', () => {
    expect(errorKeyOf(new ApiError(404, 'entity.notFound', 'x'))).toBe('errors.entity.notFound');
  });

  it('should_fallback_to_unexpected_for_other_errors', () => {
    expect(errorKeyOf(new Error('boom'))).toBe('errors.unexpected');
    expect(errorKeyOf('not an error')).toBe('errors.unexpected');
  });
});
