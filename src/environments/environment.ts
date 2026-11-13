/**
 * apiBaseUrl: '' = same origin. In development `ng serve` forwards /api/* to FastAPI
 * through proxy.conf.json (127.0.0.1:8000), so the browser makes no cross-origin calls and CORS
 * doesn't apply. For a deployed build, set the FastAPI URL here and enable CORS in FastAPI.
 *
 * useMockApi: true answers every /api/* call with built-in synthetic data (no backend needed).
 */
export const environment = {
  apiBaseUrl: '',
  useMockApi: false,
  mockLatencyMs: 350,
};
