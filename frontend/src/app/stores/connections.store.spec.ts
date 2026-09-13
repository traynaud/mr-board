import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { ConnectionsService } from '../core/api/connections.service';
import { Connection } from '../models/connection.model';
import { ConnectionsStore } from './connections.store';

describe('ConnectionsStore', () => {
  const api = {
    getConnections: vi.fn(),
    postConnection: vi.fn(),
    putConnection: vi.fn(),
    deleteConnection: vi.fn(),
    postTestConnection: vi.fn(),
  };
  const connection: Connection = {
    id: 1,
    type: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.com',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    meUsername: null,
    projectsCount: 0,
  };
  let store: InstanceType<typeof ConnectionsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: ConnectionsService, useValue: api }] });
    store = TestBed.inject(ConnectionsStore);
  });

  it('should_load_connections', async () => {
    api.getConnections.mockReturnValue(of([connection]));

    const pending = store.load();
    expect(store.loading()).toBe(true);
    await pending;

    expect(store.loading()).toBe(false);
    expect(store.connections()).toEqual([connection]);
    expect(store.loadError()).toBeNull();
  });

  it('should_expose_load_error_key', async () => {
    api.getConnections.mockReturnValue(throwError(() => new ApiError(0, undefined, 'down')));

    await store.load();

    expect(store.loadError()).toBe('errors.network');
  });

  it('should_add_connection_and_append_to_list', async () => {
    api.postConnection.mockReturnValue(of(connection));

    const pending = store.add({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-abcdwxyz',
    });
    expect(store.saving()).toBe(true);
    const error = await pending;

    expect(error).toBeNull();
    expect(store.saving()).toBe(false);
    expect(store.connections()).toEqual([connection]);
  });

  it('should_return_error_key_when_add_fails', async () => {
    api.postConnection.mockReturnValue(
      throwError(() => new ApiError(400, 'connections.nameDuplicate', 'dup')),
    );

    const error = await store.add({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-abcdwxyz',
    });

    expect(error).toBe('errors.connections.nameDuplicate');
    expect(store.connections()).toEqual([]);
  });

  it('should_update_connection_in_place', async () => {
    api.getConnections.mockReturnValue(of([connection]));
    await store.load();
    const updated = { ...connection, url: 'https://gitlab.exemple.fr' };
    api.putConnection.mockReturnValue(of(updated));

    const error = await store.update(1, { url: 'https://gitlab.exemple.fr' });

    expect(error).toBeNull();
    expect(store.connections()).toEqual([updated]);
  });

  it('should_return_error_key_when_update_fails', async () => {
    api.putConnection.mockReturnValue(
      throwError(() => new ApiError(400, 'connections.invalidUrl', 'x')),
    );

    const error = await store.update(1, { url: 'not-a-url' });

    expect(error).toBe('errors.connections.invalidUrl');
  });

  it('should_remove_connection_from_list', async () => {
    api.getConnections.mockReturnValue(of([connection]));
    await store.load();
    api.deleteConnection.mockReturnValue(of(undefined));

    const error = await store.remove(1);

    expect(error).toBeNull();
    expect(store.connections()).toEqual([]);
  });

  it('should_return_error_key_when_remove_fails', async () => {
    api.deleteConnection.mockReturnValue(
      throwError(() => new ApiError(404, 'entity.notFound', 'x')),
    );

    const error = await store.remove(99);

    expect(error).toBe('errors.entity.notFound');
  });

  it('should_test_connection_with_success', async () => {
    const result = {
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: '2027-03-12',
      expirationKnown: true,
      scopeKnown: true,
    };
    api.postTestConnection.mockReturnValue(of(result));

    const pending = store.testConnection({ connectionId: 1 });
    expect(store.test().status).toBe('pending');
    await pending;

    expect(store.test()).toEqual({ status: 'success', result, errorKey: null });
  });

  it('should_test_connection_with_error_key', async () => {
    api.postTestConnection.mockReturnValue(
      throwError(() => new ApiError(502, 'forge.auth', 'rejected')),
    );

    await store.testConnection({ connectionId: 1 });

    expect(store.test()).toEqual({ status: 'error', result: null, errorKey: 'errors.forge.auth' });
  });

  it('should_reset_test', async () => {
    api.postTestConnection.mockReturnValue(throwError(() => new Error('x')));
    await store.testConnection({ connectionId: 1 });
    expect(store.test().status).toBe('error');

    store.resetTest();

    expect(store.test().status).toBe('idle');
  });
});
