import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
