import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const KEY = 'sca-session-id';

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(KEY, id); }
    return id;
  } catch {
    return (window as unknown as { __scaSid?: string }).__scaSid ??= crypto.randomUUID();
  }
}

/**
 * Adds the x-session-id header the OpenAPI spec defines on /api/analytics/* and /api/reports/*,
 * and an x-correlation-id on every API call for audit tracing (frontend spec §15).
 * An Entra ID bearer token interceptor goes next to this one when auth is wired up.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const headers: Record<string, string> = { 'x-correlation-id': crypto.randomUUID() };
  if (/\/api\/(analytics|reports)\//.test(req.url)) headers['x-session-id'] = sessionId();
  if (/\/api\/agents(\/|$)/.test(req.url.split('?')[0])) {
    if (environment.adminKey) headers['x-admin-key'] = environment.adminKey;
  }
  return next(req.clone({ setHeaders: headers }));
};
