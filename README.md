# Smart Care Analytics – Angular frontend (POC)

Angular 20 (standalone components, signals) + Apache ECharts via ngx-echarts.
Every screen calls the real backend endpoints through services; while the
FastAPI backend is not ready, a mock HTTP interceptor answers those calls with
static synthetic data.

## Run

```bash
npm install
npm start            # http://localhost:4200
```

## Switch from mock data to the real API

`src/environments/environment.ts`:

```ts
export const environment = {
  apiBaseUrl: 'http://localhost:8000', // FastAPI base URL
  useMockApi: false,                   // <- turn the mock interceptor off
  mockLatencyMs: 350,
};
```

Nothing else changes: services already call these URLs. You can also go
endpoint by endpoint: delete a route from `ROUTES` in
`core/mock/mock-api.interceptor.ts`, and that request passes through to the
real backend while the others stay mocked.

## Endpoints the UI calls

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/health` | `MetaService.health()` (not shown in UI) |
| GET | `/api/meta/filters` | Hospital / payer dropdowns (`FilterBarComponent`, Claims payer filter) |
| GET | `/api/dashboard/summary?from&to&hospital_ids` | Overview KPI cards, sparklines, change badges |
| GET | `/api/dashboard/admissions?from&to&hospital_ids&granularity=month\|week` | Overview trend (monthly/weekly), by department, heatmap; Claims LOS boxplot |
| GET | `/api/dashboard/claims?from&to&hospital_ids&payer` | Overview denial-by-payer; Claims Sankey, gauge, totals |
| GET | `/api/dashboard/claims/pending?min_days=30&payer&page&size` | Claims pending > 30 days table |
| POST | `/api/analytics/ask` | Ask page, first question |
| POST | `/api/analytics/followup` | Ask page, follow-ups (sends `conversationId`) |
| GET | `/api/analytics/history?q&status&page&size` | Query history list + summary cards |
| GET | `/api/analytics/history/{id}` | Query history detail panel |
| POST | `/api/analytics/history/{id}/rerun` | "Re-run with latest data" |
| GET | `/api/admin/agents` | Mocked only; no screen yet |

`/api/dashboard/revenue` is not called: no screen uses it in this POC.

Request/response types are in `src/app/core/models/api.models.ts`. The JSON
is **camelCase**, so in FastAPI give the Pydantic models
`model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)`
and return with `response_model_by_alias=True` (the default).

### One chart contract

Every chart, from the dashboard endpoints and from `/ask`, is a `VisualizationSpec`:

```json
{ "chartType": "bar", "title": "Denial rate by payer", "xKey": "payer",
  "series": [{ "dataKey": "denialRate", "label": "Denial rate" }],
  "data": [{ "payer": "Payer A", "denialRate": 21.4 }],
  "options": { "orientation": "horizontal", "unit": "%", "target": 8, "highlightAbove": 16 } }
```

`shared/chart/spec-to-option.ts` turns it into ECharts settings for
`line | bar | pie | heatmap | sankey | funnel | gauge | boxplot | table`.
Long-format data with `seriesKey` (e.g. month × department) becomes one series
per group. Sankey rows are `{source, target, value}`; boxplot rows are
`{<xKey>, min, q1, median, q3, max}`.

## Structure

```
src/app/
  core/
    models/api.models.ts      wire contracts
    services/                 MetaService, DashboardService, AnalyticsService
    state/filters.store.ts    shared hospital + period filters (signals)
    utils/request-state.ts    loading / data / error signal per request
    mock/                     mock interceptor, static data, rule-based /ask stand-in
    echarts.ts                tree-shaken ECharts registration
  layout/shell.component.*    sidebar, mock banner
  shared/                     chart, data-table, kpi-card, sparkline, filter-bar
  dashboard/overview.page.*   Overview
  analytics-chat/ask.page.*   Ask analytics (chat + result)
  claims/claims.page.*        Claims & payers
  history/history.page.*      Query history
```

## Notes

- **Logo:** `public/xt-global-logo.png` is cut from a screenshot; replace it with
  the original high-resolution file (same name). It sits on a light panel in the sidebar.
- **Auth:** add an Entra ID (MSAL) interceptor in `app.config.ts` next to the
  mock interceptor when wiring the real API.
- **Mock `/ask`:** a keyword-based stand-in so the chat can be demoed. It
  understands admissions, claim amount, denial rate, length of stay and pending
  claims; department names; "this year / last six / three months"; "by
  department / by hospital / compare with last year"; follow-ups that keep the
  previous plan; out-of-scope hospitals (blocked) and patient/clinical
  questions (unsupported). The real agents replace it entirely.
- The mock keeps history in memory, so it resets on page reload.
