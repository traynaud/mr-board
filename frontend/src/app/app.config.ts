import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideI18n } from './core/i18n/provide-i18n';
import { apiBaseUrlInterceptor } from './core/interceptors/api-base-url.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { provideLanguage } from './core/language/provide-language';
import { provideTheme } from './core/theme/provide-theme';
import { provideIcons } from './shared/icons/provide-icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor, httpErrorInterceptor])),
    provideI18n(),
    provideIcons(),
    provideTheme(),
    provideLanguage(),
  ],
};
