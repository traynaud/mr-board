import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { SettingsTransferController } from './settings-transfer.controller';
import { SettingsTransferService } from './settings-transfer.service';

@Module({
  imports: [SettingsModule, ProjectsModule],
  controllers: [SettingsTransferController],
  providers: [SettingsTransferService],
})
export class SettingsTransferModule {}
