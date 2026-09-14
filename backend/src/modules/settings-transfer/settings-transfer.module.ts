import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { SettingsTransferController } from './settings-transfer.controller';
import { SettingsTransferService } from './settings-transfer.service';

@Module({
  imports: [SettingsModule, ConnectionsModule, ProjectsModule, FavoritesModule],
  controllers: [SettingsTransferController],
  providers: [SettingsTransferService],
})
export class SettingsTransferModule {}
