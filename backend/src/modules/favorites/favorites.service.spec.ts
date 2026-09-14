import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository.find.mockResolvedValue([]);
    repository.findOneBy.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(FavoritesService);
  });

  describe('list', () => {
    it('should_return_every_favorite_row', async () => {
      const rows = [{ id: 1, projectId: 2, iid: 42, createdAt: 'x' }];
      repository.find.mockResolvedValue(rows);

      expect(await service.list()).toBe(rows);
    });
  });

  describe('add', () => {
    it('should_insert_a_new_favorite_rg_027_01', async () => {
      await service.add(2, 42);

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 2, iid: 42 }),
      );
    });

    it('should_be_idempotent_when_already_a_favorite', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 1,
        projectId: 2,
        iid: 42,
        createdAt: 'x',
      });

      await service.add(2, 42);

      expect(repository.insert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should_delete_by_project_and_iid_rg_027_04', async () => {
      await service.remove(2, 42);

      expect(repository.delete).toHaveBeenCalledWith({ projectId: 2, iid: 42 });
    });

    it('should_be_idempotent_when_not_a_favorite', async () => {
      await expect(service.remove(2, 42)).resolves.toBeUndefined();
    });
  });
});
