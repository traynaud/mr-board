import { Module } from '@nestjs/common';
import { TokenCipherService } from './token-cipher.service';

/** Provides symmetric encryption for secrets at rest. */
@Module({
  providers: [TokenCipherService],
  exports: [TokenCipherService],
})
export class CryptoModule {}
