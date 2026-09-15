import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../../common/crypto/crypto.module.js';
import { ForgesModule } from '../forges/forges.module.js';
import { Project } from '../projects/entities/project.entity.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';
import { Connection } from './entities/connection.entity.js';

/**
 * Manages forge connections (RG-019-*). Depends only on `ForgesModule` and
 * `Project` (for `projectsCount`) — never on `SettingsModule`/
 * `ProjectsModule`, which depend on this module instead.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Connection, Project]),
    CryptoModule,
    ForgesModule,
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
