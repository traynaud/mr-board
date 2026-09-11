/**
 * Environnement d'exécution. En dev, `/api` est proxifié vers le backend
 * (proxy.conf.json) ; en prod, le frontend est servi sur la même origine.
 */
export const environment = {
  apiBaseUrl: '/api/v1',
};
