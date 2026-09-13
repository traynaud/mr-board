import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from './testing';
import { TranslatePipe } from './translate.pipe';
import { TranslateService } from './translate.service';

describe('TranslatePipe', () => {
  it('should_translate_with_real_dictionary', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('common.save')).toBe('Enregistrer');
    expect(pipe.transform('common.save')).toBe(t('common.save'));
  });

  it('should_pass_params_to_service', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(TranslateService);
    service.use({ msg: '{{n}} MRs' });

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('msg', { n: 2 })).toBe('2 MRs');
  });

  describe('réactivité au changement de langue (RG-022-12)', () => {
    // Régression : sans lecture du signal `language` dans `transform()`, ce
    // composant enfant `OnPush` déjà stable n'a aucune autre raison d'être
    // revérifié quand son parent est rafraîchi pour une tout autre raison —
    // c'est exactement le scénario d'un changement de langue déclenché
    // ailleurs dans l'application (ex. `LanguageService`), sans qu'aucun
    // `@Input` ni événement du composant enfant ne change lui-même.
    @Component({
      selector: 'app-label-child',
      imports: [TranslatePipe],
      template: `{{ 'common.save' | translate }}`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class LabelChildComponent {}

    @Component({
      selector: 'app-label-host',
      imports: [LabelChildComponent],
      template: `<app-label-child />`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class LabelHostComponent {}

    let fixture: ComponentFixture<LabelHostComponent>;
    let service: TranslateService;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [LabelHostComponent] });
      service = TestBed.inject(TranslateService);
      service.use({ common: { save: 'Enregistrer' } }, 'fr');
      fixture = TestBed.createComponent(LabelHostComponent);
      fixture.detectChanges();
    });

    it('should_rerender_an_already_stable_onpush_child_when_the_language_changes_elsewhere', () => {
      expect(fixture.nativeElement.textContent.trim()).toBe('Enregistrer');

      // Changement de langue déclenché ailleurs (ex. LanguageService), sans
      // qu'aucun `@Input` ni événement de LabelChildComponent ne change —
      // seul le parent, sans aucun lien avec la langue, est re-contrôlé.
      service.use({ common: { save: 'Save' } }, 'en');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent.trim()).toBe('Save');
    });
  });
});
