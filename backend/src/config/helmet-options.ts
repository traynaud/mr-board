import { HelmetOptions } from 'helmet';

/**
 * Builds the Helmet options.
 * API-only mode keeps Helmet defaults. When the frontend is served by this
 * process (`STATIC_DIR`), the CSP is relaxed just enough for the Angular app:
 * Google Fonts (Archivo), GitLab avatars over http/https, and no forced
 * `upgrade-insecure-requests` so the app works over plain http (LAN, Docker).
 * @param staticDir configured frontend directory, undefined in API-only mode.
 */
export function buildHelmetOptions(staticDir?: string): HelmetOptions {
  if (!staticDir) {
    return {};
  }
  return {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https:', 'http:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': null,
      },
    },
    crossOriginEmbedderPolicy: false,
  };
}
