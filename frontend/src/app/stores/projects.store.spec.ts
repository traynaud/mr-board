import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { ProjectsService } from '../core/api/projects.service';
import { Project } from '../models/project.model';
import { ProjectsStore } from './projects.store';

describe('ProjectsStore', () => {
  const api = {
    getProjects: vi.fn(),
    postProject: vi.fn(),
    putProject: vi.fn(),
    deleteProject: vi.fn(),
  };
  const project: Project = {
    id: 1,
    connectionId: 1,
    pathWithNamespace: 'equipe/backend-api',
    alias: 'api',
    remoteProjectId: '42',
    color: null,
  };
  let store: InstanceType<typeof ProjectsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: ProjectsService, useValue: api }] });
    store = TestBed.inject(ProjectsStore);
  });

  it('should_load_projects', async () => {
    api.getProjects.mockReturnValue(of([project]));

    const pending = store.load();
    expect(store.loading()).toBe(true);
    await pending;

    expect(store.loading()).toBe(false);
    expect(store.projects()).toEqual([project]);
    expect(store.loadError()).toBeNull();
  });

  it('should_expose_load_error_key', async () => {
    api.getProjects.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    await store.load();

    expect(store.loadError()).toBe('errors.network');
  });

  it('should_add_project_and_append_to_list', async () => {
    api.postProject.mockReturnValue(of(project));

    const pending = store.add({ path: 'equipe/backend-api', alias: 'api' });
    expect(store.adding()).toBe(true);
    const error = await pending;

    expect(error).toBeNull();
    expect(store.adding()).toBe(false);
    expect(store.projects()).toEqual([project]);
  });

  it('should_return_error_key_when_add_fails', async () => {
    api.postProject.mockReturnValue(
      throwError(() => new ApiError(400, 'projects.aliasDuplicate', 'dup')),
    );

    const error = await store.add({ path: 'equipe/backend-api' });

    expect(error).toBe('errors.projects.aliasDuplicate');
    expect(store.adding()).toBe(false);
    expect(store.projects()).toEqual([]);
  });

  it('should_rename_project_in_place', async () => {
    api.getProjects.mockReturnValue(of([project]));
    await store.load();
    const renamed = { ...project, alias: 'back' };
    api.putProject.mockReturnValue(of(renamed));

    const error = await store.rename(1, { alias: 'back', color: null });

    expect(error).toBeNull();
    expect(store.projects()).toEqual([renamed]);
  });

  it('should_return_error_key_when_rename_fails_without_mutating_list', async () => {
    api.getProjects.mockReturnValue(of([project]));
    await store.load();
    api.putProject.mockReturnValue(
      throwError(() => new ApiError(400, 'projects.aliasDuplicate', 'dup')),
    );

    const error = await store.rename(1, { alias: 'web', color: null });

    expect(error).toBe('errors.projects.aliasDuplicate');
    expect(store.projects()).toEqual([project]);
  });

  it('should_remove_project_from_list', async () => {
    api.getProjects.mockReturnValue(of([project]));
    await store.load();
    api.deleteProject.mockReturnValue(of(undefined));

    const error = await store.remove(1);

    expect(error).toBeNull();
    expect(store.projects()).toEqual([]);
  });

  it('should_return_error_key_when_remove_fails', async () => {
    api.deleteProject.mockReturnValue(
      throwError(() => new ApiError(404, 'entity.notFound', 'x')),
    );

    const error = await store.remove(99);

    expect(error).toBe('errors.entity.notFound');
  });
});
