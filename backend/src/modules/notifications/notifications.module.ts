import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsModule } from '../connections/connections.module.js';
import { MergeRequestEvent } from '../history/entities/merge-request-event.entity.js';
import { SettingsModule } from '../settings/settings.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/** Notifications of the history: unseen events, counter and dismissal (US-039/040). */
@Module({
  imports: [
    TypeOrmModule.forFeature([MergeRequestEvent]),
    ConnectionsModule,
    SettingsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
