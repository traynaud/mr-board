import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { ForgeUser } from '../forges/types/forge-user';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

function forgeUser(overrides: Partial<ForgeUser> = {}): ForgeUser {
  return {
    remoteUserId: '42',
    username: 'mdupont',
    name: 'Marie Dupont',
    avatarUrl: 'https://gitlab.example.com/mdupont.png',
    webUrl: 'https://gitlab.example.com/mdupont',
    ...overrides,
  };
}

interface UserRepoMock {
  findOneBy: jest.Mock;
  findBy: jest.Mock;
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
            findBy: jest.fn(),
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

    const user = await service.upsert(1, forgeUser());

    expect(repository.findOneBy).toHaveBeenCalledWith({
      connectionId: 1,
      remoteUserId: '42',
    });
    expect(repository.create).toHaveBeenCalledWith({
      connectionId: 1,
      remoteUserId: '42',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 1,
        remoteUserId: '42',
        username: 'mdupont',
      }),
    );
    expect(user).toEqual(expect.objectContaining({ username: 'mdupont' }));
  });

  it('should_refresh_profile_fields_of_an_existing_user', async () => {
    const existing: User = {
      id: 7,
      connectionId: 1,
      remoteUserId: '42',
      username: 'old-username',
      name: 'Old Name',
      avatarUrl: null,
      webUrl: 'https://gitlab.example.com/old-username',
    };
    repository.findOneBy.mockResolvedValue(existing);

    await service.upsert(1, forgeUser({ username: 'mdupont-new' }));

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, username: 'mdupont-new' }),
    );
  });

  it('should_scope_the_same_remote_id_to_different_connections', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await service.upsert(2, forgeUser());

    expect(repository.findOneBy).toHaveBeenCalledWith({
      connectionId: 2,
      remoteUserId: '42',
    });
  });

  describe('findByIds', () => {
    it('should_return_matching_entities', async () => {
      const user: User = {
        id: 1,
        connectionId: 1,
        remoteUserId: '42',
        username: 'mdupont',
        name: 'Marie Dupont',
        avatarUrl: null,
        webUrl: 'https://gitlab.example.com/mdupont',
      };
      repository.findBy.mockResolvedValue([user]);

      await expect(service.findByIds([1])).resolves.toEqual([user]);
      expect(repository.findBy).toHaveBeenCalledWith({ id: In([1]) });
    });

    it('should_not_query_when_the_id_list_is_empty', async () => {
      await expect(service.findByIds([])).resolves.toEqual([]);
      expect(repository.findBy).not.toHaveBeenCalled();
    });
  });
});
