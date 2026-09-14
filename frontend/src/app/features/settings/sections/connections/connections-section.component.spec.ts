import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { apiBaseUrlInterceptor } from '../../../../core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { Connection } from '../../../../models/connection.model';
import { Project } from '../../../../models/project.model';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { RepoAliasForm, buildRepoAliasGroup } from '../../repos-form';
import { RepoRow } from '../repositories/repositories-section.component';
import { ConnectionsSectionComponent } from './connections-section.component';

const CONNECTION: Connection = {
  id: 1,
  type: 'gitlab',
  name: 'GitLab',
  url: 'https://gitlab.com',
  tokenConfigured: true,
  tokenHint: 'wxyz',
  meUsername: null,
  projectsCount: 1,
};
const PROJECT: Project = {
  id: 1,
  connectionId: 1,
  pathWithNamespace: 'equipe/backend-api',
  alias: 'api',
  remoteProjectId: '42',
  color: null,
};

function rowOf(p: Project): RepoRow {
  return { project: p, group: buildRepoAliasGroup(p) as RepoAliasForm };
}

@Component({
  imports: [ConnectionsSectionComponent],
  template: `<app-connections-section [rows]="rows()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly rows = signal<RepoRow[]>([]);
}

describe('ConnectionsSectionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
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
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const loadConnections = async (
    connections: Connection[] = [],
    projects: Project[] = [],
  ) => {
    http.expectOne('/api/v1/connections').flush(connections);
    http.expectOne('/api/v1/projects').flush(projects);
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
  const summaryFor = (name: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('.connection-summary')).find((row) =>
      row.textContent?.includes(name),
    )!;
  const testIcon = (name: string) =>
    summaryFor(name).querySelector<HTMLButtonElement>(
      '[aria-label="' + t('settings.connections.list.test') + '"]',
    )!;
  const removeIcon = (name: string) =>
    summaryFor(name).querySelector<HTMLButtonElement>(
      '[aria-label="' + t('settings.connections.list.remove', { name }) + '"]',
    )!;

  it('should_show_error_and_retry', async () => {
    http.expectOne('/api/v1/connections').flush('down', { status: 500, statusText: 'KO' });
    http.expectOne('/api/v1/projects').flush([]);
    await settle();

    expect(el.querySelector('.status.error')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('.status.error button')!.click();
    http.expectOne('/api/v1/connections').flush([CONNECTION]);
    await settle();

    expect(el.querySelector('.connections-list')).not.toBeNull();
  });

  it('should_show_a_load_error_for_the_repos_and_allow_retrying', async () => {
    http.expectOne('/api/v1/connections').flush([CONNECTION]);
    http.expectOne('/api/v1/projects').flush('down', { status: 500, statusText: 'KO' });
    await settle();

    expect(el.querySelector('.status.error')?.textContent).toContain(
      t('settings.connections.repos.loadError'),
    );
    el.querySelectorAll<HTMLButtonElement>('.status.error button')[0]!.click();
    http.expectOne('/api/v1/projects').flush([]);
    await settle();

    expect(el.querySelector('.status.error')).toBeNull();
  });

  it('should_show_the_empty_state_when_there_is_no_connection', async () => {
    await loadConnections([]);

    expect(el.querySelector('.status')?.textContent?.trim()).toBe(t('settings.connections.empty'));
    expect(el.querySelector('.connections-list')).toBeNull();
  });

  it('should_render_a_row_per_connection_collapsed_by_default', async () => {
    await loadConnections([CONNECTION]);

    expect(el.querySelector('.connections-list')).not.toBeNull();
    expect(el.textContent).toContain('GitLab');
    expect(el.textContent).toContain('https://gitlab.com');
    // RG-021-00a : nombre de repos affiché sur la ligne repliée.
    expect(el.textContent).toContain(t('settings.connections.list.repoCount', { count: 1 }));
    expect(el.querySelector('.connection-details')).toBeNull();
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

  it('should_allow_selecting_the_github_type', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();

    const githubRadio = Array.from(el.querySelectorAll('mat-radio-button')).find((b) =>
      b.textContent?.includes(t('settings.connections.form.typeGithub')),
    );
    expect(githubRadio?.querySelector('input')?.disabled).toBe(false);
  });

  it('should_reapply_the_github_defaults_when_switching_type', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();

    const githubRadioInput = Array.from(
      el.querySelectorAll<HTMLInputElement>('mat-radio-button input'),
    ).find((input) => input.value === 'github')!;
    githubRadioInput.click();
    await settle();

    const nameInput = el.querySelector<HTMLInputElement>('input[formControlName="name"]')!;
    const urlInput = el.querySelector<HTMLInputElement>('input[formControlName="url"]')!;
    expect(nameInput.value).toBe('github.com');
    expect(urlInput.value).toBe('https://github.com');
    expect(el.querySelector('.token-help')?.textContent?.trim()).toBe(
      t('settings.connections.form.tokenHelpGithub'),
    );
  });

  it('should_add_a_connection_toast_and_stay_expanded_with_its_repos_table_rg_021_00a', async () => {
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
    // RG-021-00a : la carte reste dépliée, formulaire ET tableau de repos visibles.
    expect(el.querySelector('.connection-details')).not.toBeNull();
    expect(el.querySelector('.repos-table')).not.toBeNull();
  });

  it('should_expand_a_row_on_click_and_show_its_form_and_repos', async () => {
    fixture.componentInstance.rows.set([rowOf(PROJECT)]);
    await loadConnections([CONNECTION], [PROJECT]);

    summaryFor('GitLab').click();
    await settle();

    expect(el.querySelector('input[formControlName="url"]')).toHaveProperty(
      'value',
      'https://gitlab.com',
    );
    expect(el.querySelector('mat-radio-group')).toBeNull();
    expect(el.querySelector('.type-static')).not.toBeNull();
    expect(el.querySelector('.repos-table')).not.toBeNull();
    expect(el.textContent).toContain('equipe/backend-api');
  });

  it('should_collapse_an_expanded_row_on_a_second_click', async () => {
    await loadConnections([CONNECTION], [PROJECT]);
    summaryFor('GitLab').click();
    await settle();
    expect(el.querySelector('.connection-details')).not.toBeNull();

    summaryFor('GitLab').click();
    await settle();

    expect(el.querySelector('.connection-details')).toBeNull();
  });

  it('should_only_keep_one_row_expanded_at_a_time_rg_021_00a', async () => {
    await loadConnections([CONNECTION, { ...CONNECTION, id: 2, name: 'github.com', type: 'github' }]);

    summaryFor('GitLab').click();
    await settle();
    summaryFor('github.com').click();
    await settle();

    expect(el.querySelectorAll('.connection-details')).toHaveLength(1);
    expect(el.querySelector('.connection-row.expanded')?.textContent).toContain('github.com');
  });

  it('should_scope_repos_to_the_expanded_connection_only', async () => {
    const otherProject: Project = { ...PROJECT, id: 2, connectionId: 2, alias: 'web', pathWithNamespace: 'equipe/web' };
    fixture.componentInstance.rows.set([rowOf(PROJECT), rowOf(otherProject)]);
    await loadConnections(
      [CONNECTION, { ...CONNECTION, id: 2, name: 'github.com', type: 'github' }],
      [PROJECT, otherProject],
    );

    summaryFor('GitLab').click();
    await settle();

    expect(el.textContent).toContain('equipe/backend-api');
    expect(el.textContent).not.toContain('equipe/web');
  });

  it('should_update_a_connection_keeping_the_token_when_omitted', async () => {
    await loadConnections([CONNECTION], [PROJECT]);
    summaryFor('GitLab').click();
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
    // Reste dépliée après modification (pas de fermeture forcée).
    expect(el.querySelector('.connection-details')).not.toBeNull();
  });

  it('should_remove_a_connection_from_its_row_icon_after_confirmation', async () => {
    await loadConnections([CONNECTION], [PROJECT]);
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    removeIcon('GitLab').click();
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

  it('should_remove_a_connection_from_the_expanded_footer_link', async () => {
    await loadConnections([CONNECTION], [PROJECT]);
    summaryFor('GitLab').click();
    await settle();
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    el.querySelector<HTMLButtonElement>('.delete-link')!.click();
    await settle();

    const req = http.expectOne('/api/v1/connections/1');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(el.querySelector('.connection-details')).toBeNull();
  });

  it('should_not_remove_a_connection_when_confirmation_is_declined', async () => {
    await loadConnections([CONNECTION], [PROJECT]);
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    removeIcon('GitLab').click();
    await settle();

    http.expectNone('/api/v1/connections/1');
  });

  it('should_not_toggle_the_row_when_clicking_the_test_or_remove_icons', async () => {
    await loadConnections([CONNECTION], [PROJECT]);

    testIcon('GitLab').click();
    await settle();
    http.expectOne('/api/v1/connections/test').flush({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
      scopeKnown: true,
    });
    await settle();

    expect(el.querySelector('.connection-details')).toBeNull();
  });

  it('should_test_from_the_list_with_the_stored_token_and_toast_the_result', async () => {
    await loadConnections([CONNECTION], [PROJECT]);

    testIcon('GitLab').click();
    await settle();

    const req = http.expectOne('/api/v1/connections/test');
    expect(req.request.body).toEqual({ connectionId: 1 });
    req.flush({
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: null,
      expiresAt: null,
      expirationKnown: true,
      scopeKnown: true,
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
      scopeKnown: true,
    });
    await settle();

    expect(el.querySelector('.test-result.success')).not.toBeNull();
  });

  it('should_close_the_form_on_cancel_without_confirmation_when_pristine', async () => {
    await loadConnections([]);
    addButton().click();
    await settle();
    expect(el.querySelector('.new-connection')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('.form-actions button[mat-button]')!.click();
    await settle();

    expect(el.querySelector('.new-connection')).toBeNull();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('should_ask_confirmation_before_discarding_a_dirty_form_when_toggling_another_row', async () => {
    await loadConnections([CONNECTION, { ...CONNECTION, id: 2, name: 'github.com', type: 'github' }], [PROJECT]);
    summaryFor('GitLab').click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'Changed');
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    summaryFor('github.com').click();
    await settle();

    expect(dialog.open).toHaveBeenCalled();
    expect(el.querySelector('.connection-row.expanded')?.textContent).toContain('github.com');
  });

  it('should_keep_the_row_expanded_when_discarding_is_declined', async () => {
    await loadConnections([CONNECTION, { ...CONNECTION, id: 2, name: 'github.com', type: 'github' }], [PROJECT]);
    summaryFor('GitLab').click();
    await settle();
    await type(el.querySelector('input[formControlName="name"]')!, 'Changed');
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    summaryFor('github.com').click();
    await settle();

    expect(el.querySelector('.connection-row.expanded')?.textContent).toContain('GitLab');
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
    expect(el.querySelector('.new-connection')).not.toBeNull();
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
        { statusCode: 400, code: 'connections.unknown', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.connections.unknown'),
      t('common.ok'),
      expect.anything(),
    );
  });
});
