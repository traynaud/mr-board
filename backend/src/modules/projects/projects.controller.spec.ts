import { Test } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  const service = {
    list: jest.fn(),
    add: jest.fn(),
    rename: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(ProjectsController);
  });

  it('should_list_projects', async () => {
    service.list.mockResolvedValue([{ id: 1 }]);

    await expect(controller.list()).resolves.toEqual([{ id: 1 }]);
  });

  it('should_add_project', async () => {
    const dto = { path: 'equipe/backend-api', alias: 'api' };
    service.add.mockResolvedValue({ id: 1, alias: 'api' });

    await expect(controller.add(dto)).resolves.toEqual({ id: 1, alias: 'api' });
    expect(service.add).toHaveBeenCalledWith(dto);
  });

  it('should_rename_project', async () => {
    service.rename.mockResolvedValue({ id: 1, alias: 'back' });

    await expect(controller.rename(1, { alias: 'back' })).resolves.toEqual({
      id: 1,
      alias: 'back',
    });
    expect(service.rename).toHaveBeenCalledWith(1, { alias: 'back' });
  });

  it('should_remove_project', async () => {
    service.remove.mockResolvedValue(undefined);

    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
