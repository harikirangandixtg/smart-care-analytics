import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { delay, dematerialize, materialize, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AskRequest, DashboardFilters, Granularity, HistoryStatus } from '../models/api.models';
import { MockError, mockAsk, mockFollowup, mockHistory, mockHistoryDetail, mockRerun } from './mock-analytics';
import * as data from './mock-data';

type Handler = (req: HttpRequest<unknown>, params: URLSearchParams, match: RegExpMatchArray) => unknown;

function filtersFrom(p: URLSearchParams): DashboardFilters {
  return { hospitalIds: p.getAll('hospital_ids'), from: p.get('from') ?? '2026-01-01', to: p.get('to') ?? '2026-10-31' };
}

const ROUTES: { method: string; path: RegExp; handle: Handler }[] = [
  { method: 'GET', path: /^\/health$/, handle: () => ({ status: 'ok', mode: 'mock' }) },
  { method: 'GET', path: /^\/api\/meta\/filters$/, handle: () => data.filterOptions() },
  { method: 'GET', path: /^\/api\/dashboard\/summary$/, handle: (_r, p) => data.summary(filtersFrom(p)) },
  { method: 'GET', path: /^\/api\/dashboard\/admissions$/, handle: (_r, p) => data.admissions(filtersFrom(p), (p.get('granularity') as Granularity) ?? 'month') },
  { method: 'GET', path: /^\/api\/dashboard\/claims$/, handle: (_r, p) => data.claims(filtersFrom(p), p.get('payer') ?? undefined) },
  { method: 'GET', path: /^\/api\/dashboard\/claims\/pending$/, handle: (_r, p) =>
      data.pendingClaims(filtersFrom(p), Number(p.get('min_days') ?? 30), p.get('payer') ?? undefined, Number(p.get('page') ?? 1), Number(p.get('size') ?? 6)) },
  { method: 'POST', path: /^\/api\/analytics\/ask$/, handle: r => mockAsk(r.body as AskRequest) },
  { method: 'POST', path: /^\/api\/analytics\/followup$/, handle: r => mockFollowup(r.body as AskRequest) },
  { method: 'GET', path: /^\/api\/analytics\/history$/, handle: (_r, p) =>
      mockHistory({ q: p.get('q') ?? '', status: (p.get('status') ?? '') as HistoryStatus | '', page: Number(p.get('page') ?? 1), size: Number(p.get('size') ?? 10) }) },
  { method: 'GET', path: /^\/api\/analytics\/history\/([^/]+)$/, handle: (_r, _p, m) => mockHistoryDetail(decodeURIComponent(m[1])) },
  { method: 'POST', path: /^\/api\/analytics\/history\/([^/]+)\/rerun$/, handle: (_r, _p, m) => mockRerun(decodeURIComponent(m[1])) },
  { method: 'GET', path: /^\/api\/admin\/agents$/, handle: () => ([
      { name: 'analytics-planner', version: '1.0.0', hash: 'mock', status: 'loaded' },
      { name: 'followup-resolver', version: '1.0.0', hash: 'mock', status: 'loaded' },
      { name: 'sql-drafter', version: '1.0.0', hash: 'mock', status: 'loaded' },
      { name: 'insights-writer', version: '1.0.0', hash: 'mock', status: 'loaded' },
      { name: 'chart-advisor', version: '1.0.0', hash: 'mock', status: 'loaded' },
    ]) },
];

/**
 * Answers the backend's endpoints with static data while `environment.useMockApi` is true.
 * Requests that match no route pass through to the network untouched.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams, window.location.origin);
  const route = ROUTES.find(r => r.method === req.method && r.path.test(url.pathname));
  if (!route) return next(req);

  const latency = environment.mockLatencyMs + Math.round(Math.random() * 150);
  try {
    const body = route.handle(req, url.searchParams, url.pathname.match(route.path)!);
    return of(new HttpResponse({ status: 200, body, url: req.url })).pipe(delay(latency));
  } catch (e) {
    const status = e instanceof MockError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'Mock error';
    // delay errors too, so loading states are visible
    return throwError(() => new HttpErrorResponse({ status, error: { message }, url: req.url })).pipe(
      materialize(), delay(latency), dematerialize(),
    );
  }
};
