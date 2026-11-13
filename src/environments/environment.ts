/**
 * Switch `useMockApi` to false once the FastAPI backend is running.
 * Services always call the real endpoint paths; when mocks are on,
 * MockApiInterceptor answers them with static data instead of the network.
 */
export const environment = {
  apiBaseUrl: 'http://localhost:8000',
  useMockApi: true,
  mockLatencyMs: 350,
};
