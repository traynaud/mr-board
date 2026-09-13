import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { ForgesModule } from '../forges/forges.module';
import { Project } from '../projects/entities/project.entity';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { Connection } from './entities/connection.entity';

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
