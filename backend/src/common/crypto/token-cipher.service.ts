import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG, AppConfig } from '../../config/configuration';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const KEY_SALT = 'mr-board-token-cipher';

/**
 * Symmetric encryption of secrets at rest (GitLab token).
 * The key is derived deterministically from `APP_SECRET` with scrypt, so a
 * change of secret makes previously stored payloads unreadable (RG-001-10).
 * Payload format: `base64(iv).base64(tag).base64(ciphertext)`.
 */
@Injectable()
export class TokenCipherService {
  private readonly logger = new Logger(TokenCipherService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const { appSecret } = config.getOrThrow<AppConfig>(APP_CONFIG);
    this.key = scryptSync(appSecret, KEY_SALT, KEY_LENGTH);
  }

  /**
   * Encrypts a plain text value.
   * @param plain the secret to protect.
   * @returns the serialised payload.
   */
  encrypt(plain: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString('base64'))
      .join('.');
  }

  /**
   * Decrypts a payload produced by {@link encrypt}.
   * @param payload the serialised payload.
   * @returns the plain text, or `null` when the payload is corrupt or was
   * encrypted with another key (a warning is logged, never the payload).
   */
  decrypt(payload: string): string | null {
    try {
      const [iv, tag, encrypted] = payload
        .split('.')
        .map((part) => Buffer.from(part, 'base64'));
      if (!iv || !tag || !encrypted || iv.length !== IV_LENGTH) {
        throw new Error('malformed payload');
      }
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      this.logger.warn(
        'Unable to decrypt stored secret (APP_SECRET changed or payload corrupt)',
      );
      return null;
    }
  }
}
