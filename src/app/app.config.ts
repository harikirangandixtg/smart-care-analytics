import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { environment } from '../environments/environment';
import { echarts } from './core/echarts';
import { mockApiInterceptor } from './core/mock/mock-api.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Add an auth interceptor (Entra ID token) here when the real API is wired up.
    provideHttpClient(withInterceptors(environment.useMockApi ? [mockApiInterceptor] : [])),
    provideEchartsCore({ echarts }),
    { provide: LOCALE_ID, useValue: 'en-IN' },
  ],
};
