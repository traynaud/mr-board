import { buildTypeOrmOptions } from './typeorm-options.js';

describe('buildTypeOrmOptions', () => {
  it('registers the deterministic accent-folding SQL function (US-038)', () => {
    const options = buildTypeOrmOptions(':memory:') as {
      prepareDatabase: (db: unknown) => void;
    };
    const registered: Record<string, (value: unknown) => unknown> = {};
    const db = {
      function: jest.fn(
        (
          name: string,
          flags: { deterministic: boolean },
          implementation: (value: unknown) => unknown,
        ) => {
          expect(flags).toEqual({ deterministic: true });
          registered[name] = implementation;
        },
      ),
    };

    options.prepareDatabase(db);

    expect(registered['mrb_fold']('Réfacto ÉCOLE')).toBe('refacto ecole');
    expect(registered['mrb_fold'](null)).toBeNull();
    expect(registered['mrb_fold'](12)).toBe(12);
  });
});
