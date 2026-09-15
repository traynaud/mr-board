import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG } from '../../config/configuration.js';
import { TokenCipherService } from './token-cipher.service.js';

function cipherWith(secret: string): TokenCipherService {
  const config = {
    getOrThrow: jest.fn().mockReturnValue({ appSecret: secret }),
  } as unknown as ConfigService;
  return new TokenCipherService(config);
}

describe('TokenCipherService', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  it('should_read_app_secret_from_config_namespace', () => {
    const getOrThrow = jest.fn().mockReturnValue({ appSecret: 'x'.repeat(16) });
    new TokenCipherService({ getOrThrow } as unknown as ConfigService);

    expect(getOrThrow).toHaveBeenCalledWith(APP_CONFIG);
  });

  it('should_round_trip_a_secret', () => {
    const cipher = cipherWith('a-very-long-secret-value');

    const payload = cipher.encrypt('glpat-abcdefghijklmnop');

    expect(payload).not.toContain('glpat');
    expect(payload.split('.')).toHaveLength(3);
    expect(cipher.decrypt(payload)).toBe('glpat-abcdefghijklmnop');
  });

  it('should_produce_different_payloads_for_same_input', () => {
    const cipher = cipherWith('a-very-long-secret-value');

    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('should_return_null_and_warn_when_key_differs', () => {
    const payload = cipherWith('secret-number-one-value').encrypt('token');

    expect(cipherWith('secret-number-two-value').decrypt(payload)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.not.stringContaining('token'));
  });

  it('should_return_null_when_payload_is_malformed', () => {
    const cipher = cipherWith('a-very-long-secret-value');

    expect(cipher.decrypt('not-a-payload')).toBeNull();
    expect(cipher.decrypt('a.b')).toBeNull();
  });

  it('should_return_null_when_payload_is_tampered', () => {
    const cipher = cipherWith('a-very-long-secret-value');
    const [iv, tag, data] = cipher.encrypt('token').split('.');
    const tampered = `${iv}.${tag}.${data.slice(0, -2)}AA`;

    expect(cipher.decrypt(tampered)).toBeNull();
  });
});
