import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MappedGitlabUser } from '../gitlab/mappers/map-graphql-merge-request';
import { User } from './entities/user.entity';

/** Manages GitLab users encountered while synchronising merge requests. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  /**
   * Upserts a user by `gitlab_user_id`, refreshing its profile fields.
   * @param gitlabUser author/reviewer/assignee mapped from a GitLab response.
   */
  async upsert(gitlabUser: MappedGitlabUser): Promise<User> {
    const existing = await this.repository.findOneBy({
      gitlabUserId: gitlabUser.gitlabUserId,
    });
    const user =
      existing ??
      this.repository.create({ gitlabUserId: gitlabUser.gitlabUserId });
    user.username = gitlabUser.username;
    user.name = gitlabUser.name;
    user.avatarUrl = gitlabUser.avatarUrl;
    user.webUrl = gitlabUser.webUrl;
    return this.repository.save(user);
  }
}
