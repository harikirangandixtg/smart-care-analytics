/**
 * Production settings (used by `ng build --configuration production`, replacing environment.ts).
 *
 * apiBaseUrl: the deployed FastAPI URL, no trailing slash. In production there is no dev proxy, so the browser
 *   calls FastAPI directly: FastAPI must allow this site's origin in CORSMiddleware
 *   (allow_origins=["https://<your-app>.azurewebsites.net"], allow_headers=["*"]), including the
 *   x-session-id, x-correlation-id and x-admin-key headers.
 * adminKey: sent as x-admin-key for the Agent Monitor. It is visible to anyone who opens the site's
 *   JavaScript, so for a shared deployment restrict the Agent Monitor with real sign-in instead.
 */
export const environment = {
  apiBaseUrl: 'https://healthcare-analytics-backend-dea3crh8cnfehhcs.centralus-01.azurewebsites.net',
  adminKey: '',
  useMockApi: false,
  mockLatencyMs: 350,
};
