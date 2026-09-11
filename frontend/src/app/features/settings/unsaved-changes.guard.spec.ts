import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const dialog = { open: vi.fn() };
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  const run = (dirty: boolean) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard({ hasUnsavedChanges: () => dirty }, route, state, state),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: dialog }] });
  });

  it('should_allow_when_no_changes_without_dialog', async () => {
    await expect(run(false)).resolves.toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('should_allow_when_user_discards', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });

    await expect(run(true)).resolves.toBe(true);
    expect(dialog.open).toHaveBeenCalledWith(
      ConfirmDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({ titleKey: 'settings.unsaved.title' }),
      }),
    );
  });

  it('should_block_when_user_stays_or_dismisses', async () => {
    dialog.open.mockReturnValueOnce({ afterClosed: () => of(false) });
    await expect(run(true)).resolves.toBe(false);

    dialog.open.mockReturnValueOnce({ afterClosed: () => of(undefined) });
    await expect(run(true)).resolves.toBe(false);
  });
});
