# Smart Care Analytics: Angular frontend (POC)

Angular 20 (standalone components, signals) and Apache ECharts via ngx-echarts.
Six screens call the FastAPI backend exactly as defined in the
**Smart Healthcare Analytics API** OpenAPI spec (v1.0.0). Until the backend is up,
a mock interceptor answers the same paths with synthetic data.

See **VALIDATION.md** for how the Word spec, the OpenAPI spec and these screens were reconciled.

## Run

```bash
npm install
npm start        # http://localhost:4200 — /api/* is forwarded to FastAPI at 127.0.0.1:8000
```

`npm start` uses `proxy.conf.json` (wired in `angular.json`), so the browser only talks to `localhost:4200`
and CORS never applies in development. Change the port in `proxy.conf.json` if FastAPI runs elsewhere.

## Real API vs mock data

`src/environments/environment.ts`:

```ts
export const environment = { apiBaseUrl: '', useMockApi: false, mockLatencyMs: 350 };
```

- `useMockApi: false` → real FastAPI through the proxy (default).
- `useMockApi: true` → built-in synthetic data, no backend needed. Delete an entry from `ROUTES` in
  `core/mock/mock-api.interceptor.ts` to send just that endpoint to FastAPI.
- Deployed build (no dev server): set `apiBaseUrl` to the FastAPI URL and allow the app's origin in FastAPI's
  `CORSMiddleware` (`allow_headers=["*"]` — the app sends `x-session-id` and `x-correlation-id`).

## Screens and the APIs they call

| Screen (route) | Calls |
|---|---|
| Dashboard (`/dashboard`) | `GET /api/dashboard/summary`, `/admissions`, `/denials` |
| Admissions (`/admissions`) | `GET /api/dashboard/admissions`, `/trends?metric=admissions&group_by=department` |
| Revenue (`/revenue`) | `GET /api/dashboard/revenue`, `/hospitals`, `/departments` |
| Claims & denials (`/claims`) | `GET /api/dashboard/claims` (totals; and `claim_status=Pending&limit&offset` for the list), `/denials`, `/trends?metric=denial_rate` |
| AI Analytics (`/ai-analytics`) | `POST /api/analytics/ask`, `POST /api/analytics/followup`, `POST /api/reports/export` → `GET /api/reports/{id}` → `GET /api/reports/{id}?download=true` |
| Query history (`/history`) | `GET /api/analytics/history?limit=50`, `GET /api/analytics/{query_id}`, `POST /api/analytics/ask` (re-run) |
| All screens | `GET /api/metadata/hospitals`, `/departments`, `/payers` (filter options) |

Every dashboard call sends the common OpenAPI filters: `date_from`, `date_to`, `hospital_id[]`,
`department_id[]`, `payer_id[]` (arrays as repeated keys), plus `granularity` / `top` / `limit` / `offset` where defined.
`x-session-id` is added to analytics and report calls; `x-correlation-id` to all calls (`core/http/session.interceptor.ts`).

## Contracts

- **Requests**: exactly as the OpenAPI spec (`AskRequest`, `FollowupRequest`, `ExportRequest`, query params).
- **Responses**: OpenAPI documents every response as an untyped `object`, so `core/models/api.models.ts` holds the
  **proposed** shapes: snake_case envelopes (as in the spec's `/ask` example) and the camelCase chart contract from spec §14.
  The backend should publish these as Pydantic `response_model`s.

Chart contract (any dashboard chart or `/ask` result):

```json
{ "chartType": "bar", "title": "Admissions by Department", "xKey": "department",
  "series": [{ "dataKey": "admissions", "label": "Admissions" }],
  "data": [{ "department": "Cardiology", "admissions": 1250 }],
  "options": { "orientation": "horizontal", "stacked": false, "unit": "%", "target": 8 } }
```

`chartType`: `line | bar | pie | heatmap | sankey | funnel | gauge | boxplot | table`. `seriesKey` turns long-format rows
into one series per group. `ChartComponent` validates the type and field names and falls back to a table (spec §14).

## Structure

```
src/app/
  core/
    models/api.models.ts      request contracts (OpenAPI) + proposed response contracts
    services/                 MetadataService, DashboardService, AnalyticsService, ReportService, http-params
    http/session.interceptor  x-session-id, x-correlation-id
    state/filters.store.ts    global filters (hospital, department, payer, period, granularity, refresh)
    utils/request-state.ts    loading / data / error signals; safe error messages (401/403/422/timeouts)
    mock/                     mock interceptor, synthetic data, rule-based /ask stand-in, reports
  layout/                     sidebar shell
  shared/                     chart, data-table, kpi-card, stat-card, page-header, filter-bar, question-list
  features/                   dashboard, ai-analytics, admissions, revenue, claims, history
```

## Notes

- **Logo**: `public/xt-global-logo.png` was cut from a screenshot; replace it with the original file (same name).
- **Auth**: add an Entra ID (MSAL) bearer-token interceptor before `sessionInterceptor` in `app.config.ts`.
- **Mock data**: the same synthetic dataset as the design canvas (11,065 admissions, 13,280 claims, 1,345 denied,
  ₹48.6 Cr billed, Jan–Oct 2026). History lives in memory and resets on reload.

## Deploying to Azure App Service (Kudu zip deploy)

1. **API address**: set `apiBaseUrl` (and `adminKey`) in `src/environments/environment.prod.ts`.
   Production builds use this file; there is no dev proxy, so FastAPI must allow the site's origin in
   `CORSMiddleware` (`allow_origins=["https://<your-app>.azurewebsites.net"]`, `allow_headers=["*"]`).
2. **Publish profile**: Azure portal → App Service → Overview → *Download publish profile*
   (if greyed out: Configuration → General settings → *SCM Basic Auth Publishing Credentials* = On).
3. **Deploy**: `.\deploy-azure.ps1 -PublishProfile "C:\path\<app>.PublishSettings"`
   It builds, zips the contents of `dist/smart-care-analytics/browser` and posts it to
   `https://<app>.scm.azurewebsites.net/api/zipdeploy`, then waits for the result.

App Service on **Windows** uses the bundled `web.config` (all routes → `index.html`).
On **Linux**, set the startup command to `pm2 serve /home/site/wwwroot --no-daemon --spa`
(Node runtime stack). In both cases set the app setting `SCM_DO_BUILD_DURING_DEPLOYMENT=false`:
the zip is already built.
