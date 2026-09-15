import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration.js';
import { validationSchema } from './config/validation.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { ConnectionsModule } from './modules/connections/connections.module.js';
import { ForgesModule } from './modules/forges/forges.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MergeRequestsModule } from './modules/merge-requests/merge-requests.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { SettingsTransferModule } from './modules/settings-transfer/settings-transfer.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { StaticModule } from './static/static.module.js';

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
    ForgesModule,
    ConnectionsModule,
    SettingsModule,
    SettingsTransferModule,
    ProjectsModule,
    UsersModule,
    MergeRequestsModule,
    SyncModule,
  ],
})
export class AppModule {}
