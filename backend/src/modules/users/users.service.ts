import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ForgeUser } from '../forges/types/forge-user';
import { User } from './entities/user.entity';

/** Manages the users encountered while synchronising merge requests. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  /**
   * Upserts a user by (`connectionId`, `remoteUserId`) — RG-019-05,
   * refreshing its profile fields.
   * @param connectionId connection this user was encountered on.
   * @param forgeUser author/reviewer/assignee mapped from a forge response.
   */
  async upsert(connectionId: number, forgeUser: ForgeUser): Promise<User> {
    const existing = await this.repository.findOneBy({
      connectionId,
      remoteUserId: forgeUser.remoteUserId,
    });
    const user =
      existing ??
      this.repository.create({
        connectionId,
        remoteUserId: forgeUser.remoteUserId,
      });
    user.username = forgeUser.username;
    user.name = forgeUser.name;
    user.avatarUrl = forgeUser.avatarUrl;
    user.webUrl = forgeUser.webUrl;
    return this.repository.save(user);
  }

  /**
   * Raw entities for internal, server-side use only (internal `id`, not
   * `remoteUserId`) — used by `MergeRequestsService.listOpen` to resolve
   * authors/reviewers/assignees in bulk.
   * @returns entities in no particular order; missing ids are silently omitted.
   */
  async findByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.repository.findBy({ id: In(ids) });
  }
}
