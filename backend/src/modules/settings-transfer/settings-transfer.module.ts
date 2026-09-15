import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SettingsTransferController } from './settings-transfer.controller.js';
import { SettingsTransferService } from './settings-transfer.service.js';

@Module({
  imports: [SettingsModule, ConnectionsModule, ProjectsModule, FavoritesModule],
  controllers: [SettingsTransferController],
  providers: [SettingsTransferService],
})
export class SettingsTransferModule {}
