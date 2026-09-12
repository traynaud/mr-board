import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MappedGitlabUser } from '../gitlab/mappers/map-graphql-merge-request';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

function mappedUser(
  overrides: Partial<MappedGitlabUser> = {},
): MappedGitlabUser {
  return {
    gitlabUserId: 42,
    username: 'mdupont',
    name: 'Marie Dupont',
    avatarUrl: 'https://gitlab.example.com/mdupont.png',
    webUrl: 'https://gitlab.example.com/mdupont',
    ...overrides,
  };
}

interface UserRepoMock {
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: UserRepoMock;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn(
              (partial: Partial<User>) => ({ ...partial }) as User,
            ),
            save: jest.fn(
              (entity: Partial<User>) =>
                Promise.resolve({ id: 1, ...entity }) as unknown as User,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should_create_a_new_user_when_not_found', async () => {
    repository.findOneBy.mockResolvedValue(null);

    const user = await service.upsert(mappedUser());

    expect(repository.create).toHaveBeenCalledWith({ gitlabUserId: 42 });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ gitlabUserId: 42, username: 'mdupont' }),
    );
    expect(user).toEqual(expect.objectContaining({ username: 'mdupont' }));
  });

  it('should_refresh_profile_fields_of_an_existing_user', async () => {
    const existing: User = {
      id: 7,
      gitlabUserId: 42,
      username: 'old-username',
      name: 'Old Name',
      avatarUrl: null,
      webUrl: 'https://gitlab.example.com/old-username',
    };
    repository.findOneBy.mockResolvedValue(existing);

    await service.upsert(mappedUser({ username: 'mdupont-new' }));

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, username: 'mdupont-new' }),
    );
  });
});
