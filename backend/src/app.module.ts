import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { MergeRequestsModule } from './modules/merge-requests/merge-requests.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SettingsTransferModule } from './modules/settings-transfer/settings-transfer.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';
import { StaticModule } from './static/static.module';

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
    StaticModule,
    HealthModule,
    SettingsModule,
    SettingsTransferModule,
    ProjectsModule,
    UsersModule,
    MergeRequestsModule,
    SyncModule,
  ],
})
export class AppModule {}
