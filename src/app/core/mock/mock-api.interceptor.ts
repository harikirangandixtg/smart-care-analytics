import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { delay, dematerialize, materialize, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AskRequest, ClaimStatus, DashboardFilters, ExportRequest, FollowupRequest, Granularity, GroupBy, ReportResponse,
} from '../models/api.models';
import { MockError, mockAsk, mockFollowup, mockHistory, mockResult } from './mock-analytics';
import * as data from './mock-data';

type Handler = (req: HttpRequest<unknown>, q: URLSearchParams, m: RegExpMatchArray) => unknown;

const ID = /^[A-Za-z]{1,3}\d{1,4}$/;

/** Parses + validates the common dashboard filters the way FastAPI would (422 on bad input). */
function filters(q: URLSearchParams): DashboardFilters {
  const detail: { loc: (string | number)[]; msg: string; type: string }[] = [];
  const ids = (k: string) => {
    const v = q.getAll(k);
    v.forEach((x, i) => { if (!ID.test(x) || x.length > 8) detail.push({ loc: ['query', k, i], msg: `String should match pattern '^[A-Za-z]{1,3}\\d{1,4}$'`, type: 'string_pattern_mismatch' }); });
    if (v.length > 12) detail.push({ loc: ['query', k], msg: 'List should have at most 12 items', type: 'too_long' });
    return v;
  };
  const date = (k: string) => {
    const v = q.get(k);
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) detail.push({ loc: ['query', k], msg: 'Input should be a valid date', type: 'date_parsing' });
    return v;
  };
  const g = q.get('granularity');
  if (g && !['week', 'month', 'quarter'].includes(g)) detail.push({ loc: ['query', 'granularity'], msg: "Input should be 'week', 'month' or 'quarter'", type: 'enum' });
  const f: DashboardFilters = {
    date_from: date('date_from'), date_to: date('date_to'),
    hospital_id: ids('hospital_id'), department_id: ids('department_id'), payer_id: ids('payer_id'),
    claim_status: q.getAll('claim_status') as ClaimStatus[],
  };
  if (detail.length) throw Object.assign(new MockError(422, 'Validation error'), { detail });
  return f;
}
const gran = (q: URLSearchParams) => (q.get('granularity') ?? 'month') as Granularity;
const int = (q: URLSearchParams, k: string, def: number, min: number, max: number) => {
  const v = q.get(k) === null ? def : Number(q.get(k));
  if (!Number.isInteger(v) || v < min || v > max) throw Object.assign(new MockError(422, 'Validation error'), { detail: [{ loc: ['query', k], msg: `Input should be between ${min} and ${max}`, type: 'range' }] });
  return v;
};

// ----------------------------------------------------------- reports store
const reports = new Map<string, ReportResponse & { body: string; polls: number }>();
function exportReport(req: ExportRequest): ReportResponse {
  if (!req || !['analytics', 'dashboard'].includes(req.source)) throw Object.assign(new MockError(422, 'Validation error'), { detail: [{ loc: ['body', 'source'], msg: "String should match pattern '^(analytics|dashboard)$'", type: 'string_pattern_mismatch' }] });
  const format = req.format ?? 'csv';
  let rows: Record<string, unknown>[] = [];
  let name = 'export';
  if (req.source === 'analytics') {
    if (!req.query_id) throw Object.assign(new MockError(422, 'Validation error'), { detail: [{ loc: ['body', 'query_id'], msg: 'query_id is required for analytics exports', type: 'missing' }] });
    const r = mockResult(req.query_id);
    rows = r.chart?.data ?? []; name = (r.chart?.title ?? 'analytics-result');
  } else {
    const f: DashboardFilters = { date_from: req.filters?.date_from ?? null, date_to: req.filters?.date_to ?? null, hospital_id: req.filters?.hospital_id ?? [], department_id: req.filters?.department_id ?? [], payer_id: req.filters?.payer_id ?? [] };
    const src: Record<string, () => unknown> = {
      admissions: () => data.admissions(f, req.granularity ?? 'month', 12).charts, revenue: () => data.revenue(f, 12).charts,
      claims: () => data.claims(f, 100, 0).charts, denials: () => data.denials(f, 12).charts,
    };
    const charts = (src[req.dashboard ?? 'admissions'] ?? src['admissions'])() as Record<string, { data: Record<string, unknown>[]; title: string }>;
    const chart = charts[req.section ?? Object.keys(charts)[0]] ?? Object.values(charts)[0];
    rows = chart?.data ?? []; name = chart?.title ?? 'dashboard';
  }
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = format === 'json' ? JSON.stringify(rows, null, 2) : [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  const report_id = crypto.randomUUID();
  const file_name = `${name.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.${format}`;
  const rec = { report_id, status: 'processing' as const, format, file_name, created_at: new Date().toISOString(), body, polls: 0 };
  reports.set(report_id, rec);
  const { body: _b, polls: _p, ...pub } = rec;
  return pub;
}
function reportStatus(id: string, download: boolean) {
  const r = reports.get(id);
  if (!r) throw new MockError(404, 'Report not found.');
  if (++r.polls >= 2) r.status = 'completed';
  if (download) {
    if (r.status !== 'completed') throw new MockError(409, 'The report is not ready yet.');
    return new Blob([r.body], { type: r.format === 'json' ? 'application/json' : 'text/csv' });
  }
  const { body: _b, polls: _p, ...pub } = r;
  return pub;
}

// ------------------------------------------------------------------ routes
const ROUTES: { method: string; path: RegExp; handle: Handler; status?: number }[] = [
  { method: 'GET', path: /^\/api\/health$/, handle: () => ({ status: 'ok', mode: 'mock' }) },
  { method: 'GET', path: /^\/api\/health\/ready$/, handle: (_r, q) => ({ status: 'ready', database: 'ok', model: q.get('deep') === 'true' ? 'ok (1-token call)' : 'not checked', mode: 'mock' }) },

  { method: 'GET', path: /^\/api\/metadata\/hospitals$/, handle: () => ({ items: data.hospitals() }) },
  { method: 'GET', path: /^\/api\/metadata\/departments$/, handle: () => ({ items: data.departments() }) },
  { method: 'GET', path: /^\/api\/metadata\/payers$/, handle: () => ({ items: data.payers() }) },
  { method: 'GET', path: /^\/api\/metadata\/metrics$/, handle: () => ({ items: data.metrics() }) },

  { method: 'GET', path: /^\/api\/dashboard\/summary$/, handle: (_r, q) => data.summary(filters(q)) },
  { method: 'GET', path: /^\/api\/dashboard\/admissions$/, handle: (_r, q) => data.admissions(filters(q), gran(q), int(q, 'top', 8, 1, 12)) },
  { method: 'GET', path: /^\/api\/dashboard\/revenue$/, handle: (_r, q) => data.revenue(filters(q), int(q, 'top', 8, 1, 12)) },
  { method: 'GET', path: /^\/api\/dashboard\/claims$/, handle: (_r, q) => data.claims(filters(q), int(q, 'limit', 25, 1, 100), int(q, 'offset', 0, 0, 100000)) },
  { method: 'GET', path: /^\/api\/dashboard\/denials$/, handle: (_r, q) => data.denials(filters(q), int(q, 'top', 8, 1, 12)) },
  { method: 'GET', path: /^\/api\/dashboard\/departments$/, handle: (_r, q) => data.dimension('departments', filters(q)) },
  { method: 'GET', path: /^\/api\/dashboard\/hospitals$/, handle: (_r, q) => data.dimension('hospitals', filters(q)) },
  { method: 'GET', path: /^\/api\/dashboard\/trends$/, handle: (_r, q) => data.trends(filters(q), q.get('metric') ?? 'admissions', (q.get('group_by') as GroupBy) ?? null, gran(q)) },

  { method: 'POST', path: /^\/api\/analytics\/ask$/, handle: r => mockAsk(r.body as AskRequest) },
  { method: 'POST', path: /^\/api\/analytics\/followup$/, handle: r => mockFollowup(r.body as FollowupRequest) },
  { method: 'GET', path: /^\/api\/analytics\/history$/, handle: (_r, q) => mockHistory(int(q, 'limit', 20, 1, 50), int(q, 'offset', 0, 0, 10000)) },
  { method: 'GET', path: /^\/api\/analytics\/([^/]+)$/, handle: (_r, _q, m) => mockResult(decodeURIComponent(m[1])) },

  { method: 'POST', path: /^\/api\/reports\/export$/, handle: r => exportReport(r.body as ExportRequest), status: 201 },
  { method: 'GET', path: /^\/api\/reports\/([^/]+)$/, handle: (_r, q, m) => reportStatus(decodeURIComponent(m[1]), q.get('download') === 'true') },

  { method: 'GET', path: /^\/api\/agents$/, handle: () => ({ items: ['analytics_planner', 'sql_generator', 'insights_agent', 'chart_formatter'].map(name => ({ name, version: '1.0.0', status: 'loaded' })) }) },
];

/**
 * While environment.useMockApi is true, answers the OpenAPI paths with static data.
 * Requests matching no route pass through to the network.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams, window.location.origin);
  // test hook: lets the e2e check record every API call (no-op unless a test sets window.__apiCalls)
  (window as unknown as { __apiCalls?: unknown[] }).__apiCalls?.push({ method: req.method, url: req.urlWithParams, body: req.body, headers: Object.fromEntries(req.headers.keys().map(k => [k, req.headers.get(k)])) });
  const route = ROUTES.find(r => r.method === req.method && r.path.test(url.pathname));
  if (!route) return next(req);

  const latency = environment.mockLatencyMs + Math.round(Math.random() * 150);
  try {
    const body = route.handle(req, url.searchParams, url.pathname.match(route.path)!);
    return of(new HttpResponse({ status: route.status ?? 200, body, url: req.url })).pipe(delay(latency));
  } catch (e) {
    const status = e instanceof MockError ? e.status : 500;
    const detail = (e as { detail?: unknown }).detail;
    const error = detail ? { detail } : { detail: e instanceof Error ? e.message : 'Mock error' };
    return throwError(() => new HttpErrorResponse({ status, error, url: req.url })).pipe(materialize(), delay(latency), dematerialize());
  }
};
