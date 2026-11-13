/**
 * apiBaseUrl: FastAPI origin. All paths start with /api (see OpenAPI spec).
 * useMockApi: true → MockApiInterceptor answers every /api/* call with static data.
 */
export const environment = {
  apiBaseUrl: 'http://localhost:8000',
  useMockApi: true,
  mockLatencyMs: 350,
};
