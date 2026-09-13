import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { t } from './testing';
import {
  TranslateService,
  interpolateTranslation,
  lookupTranslation,
} from './translate.service';

describe('TranslateService', () => {
  let service: TranslateService;
  let http: HttpTestingController;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TranslateService);
    http = TestBed.inject(HttpTestingController);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    warn.mockRestore();
  });

  it('should_load_dictionary_from_public_folder', async () => {
    const pending = service.load();
    http.expectOne('i18n/fr.json').flush({ a: { b: 'Bonjour' } });
    await pending;

    expect(service.loaded()).toBe(true);
    expect(service.translate('a.b')).toBe('Bonjour');
  });

  it('should_start_with_empty_dictionary_when_load_fails', async () => {
    const pending = service.load();
    http.expectOne('i18n/fr.json').flush('nope', { status: 500, statusText: 'KO' });
    await pending;

    expect(service.loaded()).toBe(true);
    expect(service.translate('a.b')).toBe('a.b');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('should_return_key_and_warn_once_when_missing', () => {
    service.use({});

    expect(service.translate('x.y')).toBe('x.y');
    expect(service.translate('x.y')).toBe('x.y');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('should_interpolate_params', () => {
    service.use({ msg: 'Il y a {{ days }} j et {{count}} MR' });

    expect(service.translate('msg', { days: 3, count: 7 })).toBe('Il y a 3 j et 7 MR');
  });

  it('should_default_the_language_signal_to_fr', () => {
    expect(service.language()).toBe('fr');
  });

  it('should_fetch_both_dictionaries_when_loading_a_non_french_language', async () => {
    const pending = service.load('en');
    http.expectOne('i18n/fr.json').flush({ a: { b: 'Bonjour' } });
    http.expectOne('i18n/en.json').flush({ a: { b: 'Hello' } });
    await pending;

    expect(service.language()).toBe('en');
    expect(service.translate('a.b')).toBe('Hello');
    expect(document.documentElement.lang).toBe('en');
  });

  it('should_fall_back_to_french_when_a_key_is_missing_from_the_active_language', async () => {
    const pending = service.load('en');
    http.expectOne('i18n/fr.json').flush({ a: { b: 'Bonjour', c: 'Seulement en français' } });
    http.expectOne('i18n/en.json').flush({ a: { b: 'Hello' } });
    await pending;

    expect(service.translate('a.c')).toBe('Seulement en français');
  });

  it('should_not_refetch_a_dictionary_already_in_cache', async () => {
    const first = service.load('en');
    http.expectOne('i18n/fr.json').flush({});
    http.expectOne('i18n/en.json').flush({});
    await first;

    // Repasser en fr puis en en ne doit déclencher aucune nouvelle requête :
    // http.verify() (afterEach) échouerait sinon sur une requête non attendue.
    await service.load('fr');
    await service.load('en');
  });

  it('use_should_set_the_language_signal_and_keep_french_as_fallback', () => {
    service.use({ a: 'Bonjour' }, 'fr');
    service.use({ b: 'Hello' }, 'en');

    expect(service.language()).toBe('en');
    expect(service.translate('b')).toBe('Hello');
    expect(service.translate('a')).toBe('Bonjour');
  });

  it('should_make_any_computed_calling_translate_directly_reactive_to_a_language_change', () => {
    // Régression (QA US-022, BUG-001) : un `computed()` de composant qui
    // appelle `translate()` directement (hors du pipe `| translate`) doit
    // lui aussi se recalculer quand la langue change — sans avoir à lire
    // lui-même le signal `language`. Avant le correctif, seul le pipe lisait
    // ce signal ; ce test aurait échoué (valeur figée sur 'Bonjour').
    service.use({ greeting: 'Bonjour' }, 'fr');
    const greeting = computed(() => service.translate('greeting'));
    expect(greeting()).toBe('Bonjour');

    service.use({ greeting: 'Hello' }, 'en');

    expect(greeting()).toBe('Hello');
  });
});

describe('lookupTranslation', () => {
  const dict = { a: { b: 'x' }, s: 'root' };

  it('should_resolve_nested_key', () => {
    expect(lookupTranslation(dict, 'a.b')).toBe('x');
    expect(lookupTranslation(dict, 's')).toBe('root');
  });

  it('should_return_undefined_for_branch_or_missing_or_too_deep', () => {
    expect(lookupTranslation(dict, 'a')).toBeUndefined();
    expect(lookupTranslation(dict, 'a.c')).toBeUndefined();
    expect(lookupTranslation(dict, 's.t')).toBeUndefined();
  });
});

describe('interpolateTranslation', () => {
  it('should_keep_placeholder_when_param_is_missing', () => {
    expect(interpolateTranslation('Il y a {{days}} j', {})).toBe('Il y a {{days}} j');
  });
});

describe('t (test helper)', () => {
  it('should_translate_from_real_dictionary', () => {
    expect(t('common.save')).toBe('Enregistrer');
  });

  it('should_throw_on_missing_key', () => {
    expect(() => t('nope.nope')).toThrow(/nope\.nope/);
  });
});
