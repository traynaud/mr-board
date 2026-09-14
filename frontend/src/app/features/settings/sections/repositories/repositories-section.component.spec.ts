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
import { RepoRow, RepositoriesSectionComponent } from './repositories-section.component';

const project: Project = {
  id: 1,
  connectionId: 1,
  pathWithNamespace: 'equipe/backend-api',
  alias: 'api',
  remoteProjectId: '42',
};
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

function rowOf(p: Project): RepoRow {
  return { project: p, group: buildRepoAliasGroup(p) as RepoAliasForm };
}

@Component({
  imports: [RepositoriesSectionComponent],
  template: `<app-repositories-section [connection]="connection()" [rows]="rows()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly connection = signal<Connection>(CONNECTION);
  readonly rows = signal<RepoRow[]>([rowOf(project)]);
}

describe('RepositoriesSectionComponent', () => {
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
  /** Flushe le déclenchement de synchro ciblée après un ajout réussi (RG-004-15). */
  const flushSync = async (projectId: number) => {
    const req = http.expectOne(`/api/v1/sync?projectId=${projectId}`);
    req.flush({ running: true }, { status: 202, statusText: 'Accepted' });
    await settle();
    http.expectOne('/api/v1/sync/status').flush({ running: true, lastRun: null, nextRunAt: null });
    await settle();
  };
  const pathInput = () => el.querySelector<HTMLInputElement>('input[formControlName="path"]')!;
  const addAliasInput = () =>
    el.querySelectorAll<HTMLInputElement>('input[formControlName="alias"]')[1];
  const addButton = () => el.querySelector<HTMLButtonElement>('.add-fields button')!;
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  it('should_show_the_repos_table_with_the_existing_repo_and_an_add_row', () => {
    expect(el.querySelector('.repos-table')).not.toBeNull();
    expect(el.textContent).toContain('equipe/backend-api');
    expect(addButton().disabled).toBe(true);
  });

  it('should_use_the_gitlab_path_placeholder_for_a_gitlab_connection', () => {
    expect(pathInput().placeholder).toBe(t('settings.connections.repos.pathPlaceholderGitlab'));
  });

  it('should_use_the_github_path_placeholder_for_a_github_connection', () => {
    fixture.componentInstance.connection.set({ ...CONNECTION, id: 3, type: 'github', name: 'github.com' });
    fixture.detectChanges();

    expect(pathInput().placeholder).toBe(t('settings.connections.repos.pathPlaceholderGithub'));
  });

  it('should_show_a_blocking_message_instead_of_the_add_row_when_the_connection_has_no_token_rg_021_00b', () => {
    fixture.componentInstance.connection.set({ ...CONNECTION, tokenConfigured: false });
    fixture.detectChanges();

    expect(el.querySelector('.add-fields')).toBeNull();
    expect(el.querySelector('.token-missing-row')?.textContent?.trim()).toBe(
      t('errors.connections.tokenMissing'),
    );
  });

  it('should_disable_add_button_when_path_is_empty_or_an_add_is_in_flight', async () => {
    expect(addButton().disabled).toBe(true);

    await type(pathInput(), 'equipe/front-web');
    expect(addButton().disabled).toBe(false);

    addButton().click();
    await settle();
    expect(addButton().disabled).toBe(true);

    http.expectOne('/api/v1/projects').flush({
      id: 2,
      connectionId: 1,
      pathWithNamespace: 'equipe/front-web',
      alias: 'front-web',
      remoteProjectId: '7',
    });
    await settle();
    await flushSync(2);
  });

  it('should_add_repo_scoped_to_the_connection_and_reset_form_on_success', async () => {
    await type(pathInput(), 'equipe/front-web');
    expect(addButton().disabled).toBe(false);

    addButton().click();
    await settle();
    expect(addButton().disabled).toBe(true);

    const req = http.expectOne('/api/v1/projects');
    expect(req.request.body).toEqual({ path: 'equipe/front-web', connectionId: 1 });
    req.flush({
      id: 2,
      connectionId: 1,
      pathWithNamespace: 'equipe/front-web',
      alias: 'front-web',
      remoteProjectId: '7',
    });
    await settle();
    await flushSync(2);

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.connections.repos.added'),
      t('common.ok'),
      expect.anything(),
    );
    expect(pathInput().value).toBe('');
  });

  it('should_show_inline_error_under_path_for_not_found', async () => {
    await type(pathInput(), 'equipe/inexistant');

    addButton().click();
    http
      .expectOne('/api/v1/projects')
      .flush(
        { statusCode: 400, code: 'projects.notFound', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(t('errors.projects.notFound'));
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should_show_inline_error_under_alias_for_duplicate', async () => {
    await type(pathInput(), 'equipe/autre');
    await type(addAliasInput(), 'api');

    addButton().click();
    http
      .expectOne('/api/v1/projects')
      .flush(
        { statusCode: 400, code: 'projects.aliasDuplicate', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(
      t('errors.projects.aliasDuplicate'),
    );
  });

  it('should_show_toast_for_global_precondition_errors', async () => {
    await type(pathInput(), 'equipe/x');

    addButton().click();
    http
      .expectOne('/api/v1/projects')
      .flush(
        { statusCode: 409, code: 'connections.tokenMissing', message: 'x' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(el.querySelector('mat-error')).toBeNull();
    expect(snackBar.open).toHaveBeenCalledWith(
      t('errors.connections.tokenMissing'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_clear_inline_error_when_editing_again', async () => {
    await type(pathInput(), 'equipe/inexistant');
    addButton().click();
    http
      .expectOne('/api/v1/projects')
      .flush(
        { statusCode: 400, code: 'projects.notFound', message: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(el.querySelector('mat-error')).not.toBeNull();

    await type(pathInput(), 'equipe/inexistant2');

    expect(el.querySelector('mat-error')).toBeNull();
  });

  it('should_remove_repo_after_confirmation', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    el.querySelector<HTMLButtonElement>('.delete-col button')!.click();
    await settle();

    const req = http.expectOne('/api/v1/projects/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(
      t('settings.connections.repos.removed'),
      t('common.ok'),
      expect.anything(),
    );
  });

  it('should_not_remove_repo_when_confirmation_is_declined', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    el.querySelector<HTMLButtonElement>('.delete-col button')!.click();
    await settle();

    http.expectNone('/api/v1/projects/1');
  });
});
