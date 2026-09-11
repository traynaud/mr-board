import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Préfixe les requêtes relatives commençant par `api://` avec l'URL de base
 * de l'API : `api://settings` → `/api/v1/settings`.
 * Les autres URLs (assets, absolues) sont laissées intactes.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('api://')) {
    return next(req);
  }
  const path = req.url.slice('api://'.length);
  return next(req.clone({ url: `${environment.apiBaseUrl}/${path}` }));
};
