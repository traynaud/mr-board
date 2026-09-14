import angularJson from '../../../../angular.json';

/**
 * Régression CSP/thème sombre (bug production Docker) : le builder Angular
 * inline par défaut le CSS critique en production (`optimization.styles.
 * inlineCritical`), en différant le reste via un
 * `<link media="print" onload="this.media='all'">`. Cet `onload` est un
 * attribut de script inline, bloqué par `script-src-attr 'none'` (défaut
 * Helmet, jamais surchargé par `buildHelmetOptions` — voir
 * `backend/src/config/helmet-options.ts`) : la bascule vers `media="all"`
 * n'a jamais lieu, donc la feuille de style complète (dont les surcharges
 * `[data-theme='dark']`) ne s'applique jamais à l'écran, quelle que soit la
 * préférence enregistrée. `inlineCritical` doit rester désactivé.
 */
describe('production build config (theme CSP regression)', () => {
  it('should_keep_critical_css_inlining_disabled_in_production', () => {
    const production = angularJson.projects.frontend.architect.build.configurations.production as {
      optimization?: { styles?: { inlineCritical?: boolean } | boolean };
    };

    const stylesOptimization = production.optimization?.styles;
    const inlineCritical =
      typeof stylesOptimization === 'object' ? stylesOptimization.inlineCritical : stylesOptimization;

    expect(inlineCritical).toBe(false);
  });
});
