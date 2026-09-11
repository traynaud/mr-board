import { TestBed } from '@angular/core/testing';
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
});
