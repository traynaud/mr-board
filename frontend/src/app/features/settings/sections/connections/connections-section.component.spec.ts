import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { Connection } from '../../../../models/connection.model';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { ConnectionsSectionComponent } from './connections-section.component';

const CONNECTION: Connection = {
  id: 1,
  type: 'gitlab',
  name: 'GitLab',
  url: 'https://gitlab.com',
  tokenConfigured: true,
  tokenHint: 'wxyz',
  meUsername: null,
  projectsCount: 2,
};

describe('ConnectionsSectionComponent', () => {
  let fixture: ComponentFixture<ConnectionsSectionComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ConnectionsSectionComponent],
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConnectionsSectionComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const loadConnections = async (connections: Connection[] = []) => {
    http.expectOne('/api/v1/connections').flush(connections);
    await settle();
  };
  const addButton = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(t('settings.connections.add')),
    )!;
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  it('should_show_error_and_retry', async () => {
    http.expectOne('/api/v1/connections').flush('down', { status: 500, statusText: 'KO' });
    await settle();

    expect(el.querySelector('.status.error')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('.status.error button')!.click();
    http.expectOne('/api/v1/connections').flush([CONNECTION]);
    await settle();

    expect(el.querySelector('.connections-table')).not.toBeNull();
  });

  it('should_show_the_empty_state_when_there_is_no_connection', async () => {
    await loadConnections([]);

    expect(el.querySelector('.status')?.textContent?.trim()).toBe(t('settings.connections.empty'));
    expect(el.querySelector('.connections-table')).toBeNull();
  });

  it('should_render_a_row_per_connection', async () => {
    await loadConnections([CONNECTION]);

    expect(el.querySelector('.connections-table')).not.toBeNull();
    expect(el.textContent).toContain('GitLab');
    expect(el.textContent).toContain('https://gitlab.com');
  });

  it('should_open_the_add_form_prefilled_with_defaults', async () => {
    await loadConnections([]);

    addButton().click();
    await settle();

    const nameInput = el.querySelector<HTMLInputElement>('input[formControlName="name"]')!;
    const urlInput = el.querySelector<HTMLInputElement>('input[formControlName="url"]')!;
    expect(nameInput.value).toBe('gitlab.com');
    expect(urlInput.value).toBe('https://gitlab.com');
    expect(el.querySelector('mat-radio-group')).not.toBeNull();
  });

  it('should_disable_the_github_radio_option', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();

    const githubRadio = Array.from(el.querySelectorAll('mat-radio-button')).find((b) =>
      b.textContent?.includes(t('settings.connections.form.typeGithub')),
    );
    expect(githubRadio?.querySelector('input')?.disabled).toBe(true);
  });

  it('should_add_a_connection_and_toast_on_success', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'GitLab');
    await type(el.querySelector('input[formControlName="token"]')!, 'glpat-abcdwxyz');

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-flat-button]')!.click();
    await settle();

    const req = http.expectOne('/api/v1/connections');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      type: 'gitlab',
      name: 'GitLab',
      url: 'https://gitlab.com',
      token: 'glpat-abcdwxyz',
    });
    req.flush(CONNECTION);
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.connections.added'),
      t('common.ok'),
      expect.anything(),
    );
    expect(el.querySelector('.connection-form')).toBeNull();
  });

  it('should_open_the_edit_form_without_the_token_and_with_a_read_only_type', async () => {
    await loadConnections([CONNECTION]);

    el.querySelector<HTMLButtonElement>('[aria-label="' + t('settings.connections.list.edit') + '"]')!.click();
    await settle();

    expect(el.querySelector('input[formControlName="token"]')).toHaveProperty('value', '');
    expect(el.querySelector('mat-radio-group')).toBeNull();
    expect(el.querySelector('.type-static')).not.toBeNull();
  });

  it('should_update_a_connection_keeping_the_token_when_omitted', async () => {
    await loadConnections([CONNECTION]);
    el.querySelector<HTMLButtonElement>('[aria-label="' + t('settings.connections.list.edit') + '"]')!.click();
    await settle();
    await type(el.querySelector('input[formControlName="url"]')!, 'https://gitlab.exemple.fr');

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-flat-button]')!.click();
    await settle();

    const req = http.expectOne('/api/v1/connections/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'GitLab', url: 'https://gitlab.exemple.fr' });
    req.flush({ ...CONNECTION, url: 'https://gitlab.exemple.fr' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.connections.updated'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_remove_a_connection_after_confirmation', async () => {
    await loadConnections([CONNECTION]);
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    el.querySelector<HTMLButtonElement>('[aria-label="' + t('settings.connections.list.remove', { name: 'GitLab' }) + '"]')!.click();
    await settle();

    const req = http.expectOne('/api/v1/connections/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.connections.removed'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_not_remove_a_connection_when_confirmation_is_declined', async () => {
    await loadConnections([CONNECTION]);
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    el.querySelector<HTMLButtonElement>('[aria-label="' + t('settings.connections.list.remove', { name: 'GitLab' }) + '"]')!.click();
    await settle();

    http.expectNone('/api/v1/connections/1');
  });

  it('should_test_from_the_list_with_the_stored_token_and_toast_the_result', async () => {
    await loadConnections([CONNECTION]);

    el.querySelector<HTMLButtonElement>('[aria-label="' + t('settings.connections.list.test') + '"]')!.click();
    await settle();

    const req = http.expectOne('/api/v1/connections/test');
    expect(req.request.body).toEqual({ connectionId: 1 });
    req.flush({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
    });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('GitLab'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_test_from_the_form_and_show_the_result_inline', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'GitLab');
    await type(el.querySelector('input[formControlName="token"]')!, 'glpat-abcdwxyz');

    el.querySelector<HTMLButtonElement>('.test-row button')!.click();
    await settle();

    const req = http.expectOne('/api/v1/connections/test');
    expect(req.request.body).toEqual({
      type: 'gitlab',
      url: 'https://gitlab.com',
      token: 'glpat-abcdwxyz',
    });
    req.flush({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
    });
    await settle();

    expect(el.querySelector('.test-result.success')).not.toBeNull();
  });

  it('should_close_the_form_on_cancel_without_confirmation_when_pristine', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    expect(el.querySelector('.connection-form')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-button]')!.click();
    await settle();

    expect(el.querySelector('.connection-form')).toBeNull();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('should_ask_confirmation_before_discarding_a_dirty_form_on_cancel', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'Changed');
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-button]')!.click();
    await settle();

    expect(dialog.open).toHaveBeenCalled();
    expect(el.querySelector('.connection-form')).toBeNull();
  });

  it('should_keep_the_form_open_when_discarding_is_declined', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'Changed');
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-button]')!.click();
    await settle();

    expect(el.querySelector('.connection-form')).not.toBeNull();
  });

  it('should_toggle_the_token_visibility', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();

    const tokenInput = el.querySelector<HTMLInputElement>('input[formControlName="token"]')!;
    expect(tokenInput.type).toBe('password');

    el
      .querySelector<HTMLButtonElement>(
        '[aria-label="' + t('settings.connections.form.showToken') + '"]',
      )!
      .click();
    await settle();

    expect(tokenInput.type).toBe('text');
  });

  it('should_toast_an_error_when_testing_from_the_list_fails', async () => {
    await loadConnections([CONNECTION]);

    el
      .querySelector<HTMLButtonElement>(
        '[aria-label="' + t('settings.connections.list.test') + '"]',
      )!
      .click();
    await settle();

    http
      .expectOne('/api/v1/connections/test')
      .flush(
        { statusCode: 401, code: 'forge.auth', message: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      expect.stringContaining(t('errors.forge.auth')),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_show_an_inline_error_on_the_name_field_for_a_duplicate_name', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'GitLab');
    await type(el.querySelector('input[formControlName="token"]')!, 'glpat-abcdwxyz');

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-flat-button]')!.click();
    await settle();
    http
      .expectOne('/api/v1/connections')
      .flush(
        { statusCode: 400, code: 'connections.nameDuplicate', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(
      t('errors.connections.nameDuplicate'),
    );
    expect(el.querySelector('.connection-form')).not.toBeNull();
  });

  it('should_toast_a_generic_error_on_submit_failure', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'GitLab');
    await type(el.querySelector('input[formControlName="token"]')!, 'glpat-abcdwxyz');

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-flat-button]')!.click();
    await settle();
    http
      .expectOne('/api/v1/connections')
      .flush(
        { statusCode: 400, code: 'connections.typeUnsupported', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.connections.typeUnsupported'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_close_the_edit_form_when_deleting_the_connection_being_edited', async () => {
    await loadConnections([CONNECTION]);
    el.querySelector<HTMLButtonElement>('[aria-label="' + t('settings.connections.list.edit') + '"]')!.click();
    await settle();
    expect(el.querySelector('.connection-form')).not.toBeNull();

    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    el
      .querySelector<HTMLButtonElement>(
        '[aria-label="' + t('settings.connections.list.remove', { name: 'GitLab' }) + '"]',
      )!
      .click();
    await settle();
    http.expectOne('/api/v1/connections/1').flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(el.querySelector('.connection-form')).toBeNull();
  });
});
