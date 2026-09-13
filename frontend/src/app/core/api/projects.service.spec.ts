import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProjectsService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_get_projects', async () => {
    const pending = firstValueFrom(service.getProjects());
    const req = ctrl.expectOne('/api/v1/projects');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, connectionId: 1, pathWithNamespace: 'equipe/backend-api', alias: 'api', remoteProjectId: '42' }]);

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ alias: 'api' }),
    ]);
  });

  it('should_post_project', async () => {
    const body = { path: 'equipe/backend-api', alias: 'api' };
    const pending = firstValueFrom(service.postProject(body));
    const req = ctrl.expectOne('/api/v1/projects');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, connectionId: 1, pathWithNamespace: 'equipe/backend-api', alias: 'api', remoteProjectId: '42' });

    await expect(pending).resolves.toEqual(expect.objectContaining({ id: 1 }));
  });

  it('should_put_project', async () => {
    const pending = firstValueFrom(service.putProject(1, { alias: 'back' }));
    const req = ctrl.expectOne('/api/v1/projects/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ alias: 'back' });
    req.flush({ id: 1, connectionId: 1, pathWithNamespace: 'equipe/backend-api', alias: 'back', remoteProjectId: '42' });

    await expect(pending).resolves.toEqual(expect.objectContaining({ alias: 'back' }));
  });

  it('should_delete_project', async () => {
    const pending = firstValueFrom(service.deleteProject(1));
    const req = ctrl.expectOne('/api/v1/projects/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(pending).resolves.toBeNull();
  });
});
