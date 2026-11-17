import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { environment } from '../environments/environment';
import { sessionInterceptor } from './core/http/session.interceptor';
import { mockApiInterceptor } from './core/mock/mock-api.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Add an Entra ID bearer-token interceptor before sessionInterceptor when auth is wired up.
    provideHttpClient(withInterceptors(environment.useMockApi ? [sessionInterceptor, mockApiInterceptor] : [sessionInterceptor])),
    // ECharts (~500 kB) is downloaded the first time a chart is drawn, not with the first page load.
    provideEchartsCore({ echarts: () => import('./core/echarts').then(m => m.echarts) }),
    { provide: LOCALE_ID, useValue: 'en-IN' },
  ],
};
