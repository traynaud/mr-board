import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrlInterceptor } from '../interceptors/api-base-url.interceptor';
import { ConnectionsService } from './connections.service';

describe('ConnectionsService', () => {
  let service: ConnectionsService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ConnectionsService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('should_get_connections', async () => {
    const pending = firstValueFrom(service.getConnections());
    const req = ctrl.expectOne('/api/v1/connections');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'GitLab' }]);

    await expect(pending).resolves.toEqual([{ id: 1, name: 'GitLab' }]);
  });

  it('should_post_a_connection', async () => {
    const body = { type: 'gitlab' as const, name: 'GitLab', url: 'https://gitlab.com', token: 'glpat-abcdwxyz' };
    const pending = firstValueFrom(service.postConnection(body));
    const req = ctrl.expectOne('/api/v1/connections');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, name: 'GitLab' });

    await expect(pending).resolves.toEqual(expect.objectContaining({ id: 1 }));
  });

  it('should_put_a_connection', async () => {
    const body = { url: 'https://gitlab.exemple.fr' };
    const pending = firstValueFrom(service.putConnection(1, body));
    const req = ctrl.expectOne('/api/v1/connections/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, url: 'https://gitlab.exemple.fr' });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ url: 'https://gitlab.exemple.fr' }),
    );
  });

  it('should_delete_a_connection', async () => {
    const pending = firstValueFrom(service.deleteConnection(1));
    const req = ctrl.expectOne('/api/v1/connections/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await expect(pending).resolves.toBeNull();
  });

  it('should_post_test_connection', async () => {
    const pending = firstValueFrom(service.postTestConnection({ connectionId: 1 }));
    const req = ctrl.expectOne('/api/v1/connections/test');
    expect(req.request.method).toBe('POST');
    req.flush({ username: 'mdupont' });

    await expect(pending).resolves.toEqual(expect.objectContaining({ username: 'mdupont' }));
  });
});
