import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const KEY = 'sca-session-id';
/** What the API accepts: a UUID, or 16–64 letters, digits and hyphens. */
const VALID = /^[A-Za-z0-9-]{16,64}$/;
let memory: string | null = null;

/**
 * One session ID per browser, created once and kept in localStorage, so exports and history stay
 * reachable after reloads, in new tabs and on later days. Falls back to memory if storage is blocked.
 */
export function sessionId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !VALID.test(id)) {
      const old = sessionStorage.getItem(KEY); // carry over the ID from earlier builds
      id = old && VALID.test(old) ? old : crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return (memory ??= crypto.randomUUID());
  }
}

/**
 * Adds the x-session-id header the OpenAPI spec defines on /api/analytics/* and /api/reports/*,
 * and an x-correlation-id on every API call for audit tracing (frontend spec §15).
 * An Entra ID bearer token interceptor goes next to this one when auth is wired up.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const headers: Record<string, string> = { 'x-correlation-id': crypto.randomUUID() };
  const path = req.url.split('?')[0];
  if (/\/api\/(analytics|reports)(\/|$)/.test(path)) headers['x-session-id'] = sessionId();
  if (/\/api\/agents(\/|$)/.test(req.url.split('?')[0])) {
    if (environment.adminKey) headers['x-admin-key'] = environment.adminKey;
  }
  return next(req.clone({ setHeaders: headers }));
};
