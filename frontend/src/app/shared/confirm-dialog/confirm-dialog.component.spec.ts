import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  const data: ConfirmDialogData = {
    titleKey: 'settings.unsaved.title',
    messageKey: 'settings.unsaved.message',
    confirmKey: 'settings.unsaved.discard',
    cancelKey: 'settings.unsaved.stay',
  };
  const dialogRef = { close: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        provideI18nTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
  });

  it('should_render_translated_texts_and_close_with_choice', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h2')?.textContent?.trim()).toBe(t('settings.unsaved.title'));
    expect(el.querySelector('mat-dialog-content')?.textContent?.trim()).toBe(
      t('settings.unsaved.message'),
    );
    const buttons = el.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons[0].textContent?.trim()).toBe(t('settings.unsaved.stay'));
    expect(buttons[1].textContent?.trim()).toBe(t('settings.unsaved.discard'));

    buttons[1].click();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    buttons[0].click();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});

describe('ConfirmDialogComponent with messageParams', () => {
  const data: ConfirmDialogData = {
    titleKey: 'settings.misc.importConfirm.title',
    messageKey: 'settings.misc.importConfirm.message',
    confirmKey: 'settings.misc.importConfirm.confirm',
    cancelKey: 'settings.misc.importConfirm.cancel',
    messageParams: { settingsCount: 12, totalRepos: 2, newRepos: 1 },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        provideI18nTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('should_interpolate_the_message_params', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('mat-dialog-content')?.textContent?.trim()).toBe(
      t('settings.misc.importConfirm.message', { settingsCount: 12, totalRepos: 2, newRepos: 1 }),
    );
  });
});
