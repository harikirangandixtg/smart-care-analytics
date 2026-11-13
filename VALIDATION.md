# Validation: frontend spec vs OpenAPI vs existing screens

Sources checked:
- **Spec**: *Smart Healthcare Analytics — Angular Frontend Screens* (Word, v1.0, Nov 2026), 18 sections + appendix.
- **API**: *Smart Healthcare Analytics API* OpenAPI 3.1, v1.0.0 (24 operations, 6 request schemas).
- **Screens**: the six designed screens (Dashboard, AI Analytics, Admissions, Revenue, Claims & denials, Query history).

Rule applied: **the OpenAPI spec wins** for paths, parameters and request bodies (it reflects the implemented FastAPI routers; the spec's appendix says its paths "may be adjusted to match the implemented FastAPI routers"). Scope is limited to the existing six screens.

## 1. Blocking issue for the backend team

| # | Finding | Impact | What the frontend does |
|---|---|---|---|
| 1 | **Every 200 response in OpenAPI is an untyped `object`** (`additionalProperties: true`). No response shape is documented for any endpoint. | The frontend can't be validated against the API; any field rename breaks a screen silently. | `core/models/api.models.ts` defines the **proposed** response contract for every endpoint (snake_case envelopes, camelCase chart objects per spec §14). The mock implements exactly these shapes. **Backend should add Pydantic `response_model`s matching this file.** |

## 2. Conflicts between the Word spec and OpenAPI

| # | Spec says | OpenAPI says | Decision |
|---|---|---|---|
| 2 | Admissions example uses `start_date`, `end_date`, `group_by=month` (§5) | `date_from`, `date_to`, `granularity=week\|month\|quarter`; `group_by` exists only on `/trends` (`hospital\|department\|payer`) | OpenAPI. Admissions "Group by" offers Week / Month / Quarter (no Day). |
| 3 | `hospital_id=H001`, `department_id=D001` as single values | Arrays (repeat the key), max 12 items, pattern `^[A-Za-z]{1,3}\d{1,4}$`, max 8 chars | Sent as repeated keys. Mock validates the pattern and returns FastAPI-style 422s. |
| 4 | Ask example body has `"hospital_id": "H001"` and `"year": 2026` | `AskFilters` = `date_from`, `date_to`, `hospital_id[]`, `department_id[]`, `payer_id[]`; no `year` | OpenAPI. Year becomes a date range. **Fix the example in §4 of the spec.** |
| 5 | Ask response example uses `"query_id": "Q1001"`, `"conversation_id": "C1001"` | `conversation_id` is `format: uuid` | UUIDs. **Fix the example IDs in the spec.** |
| 6 | Follow-up "without restating prior filters" | `FollowupRequest` = `conversation_id` (required) + `question` only | Follow-ups send only those two fields; filters stay with the conversation server-side. |
| 7 | Reports: `GET /api/reports/{report_id}/download`; formats CSV or Excel | Download is `GET /api/reports/{report_id}?download=true`; `format` is `csv\|json` only | OpenAPI. Excel isn't available. |
| 8 | Agent instructions at `/api/admin/agents/{name}/instructions`; `POST /api/admin/agents/reload` | `/api/agents/{name}/instructions` (header `x-admin-key`); **no reload endpoint** | Not used (Agent Monitor isn't one of the existing screens). **Spec and API disagree; agree one.** |
| 9 | `GET /api/metadata/date-ranges` | **Not in OpenAPI** | Period presets are defined in `filters.store.ts`. Add the endpoint or drop it from the spec. |
| 10 | Health check `/api/health` | Same, plus `/api/health/ready?deep=` | `MetadataService.health()` / `ready()`; not shown in the UI. |
| 11 | Spec §11 lists `/api/admin/*`; OpenAPI also has `/api/agents/{name}/execute` | — | Not used by the existing screens. |

## 3. Gaps: things the screens need that the API doesn't offer

| # | Screen need | Gap | Workaround in this build | Recommended API change |
|---|---|---|---|---|
| 12 | Query history search and status filter, summary counts | `/history` takes only `limit` (≤50) and `offset` | Loads the latest 50 and filters / counts in the browser; labels say "of the latest 50" | Add `q` and `status` query params and a `summary` block |
| 13 | "Re-run with latest data" | No re-run endpoint | Re-asks the same question with `POST /ask` as a new conversation | Optional `POST /api/analytics/{query_id}/rerun` |
| 14 | "Pending claims older than 30 days" list | `/dashboard/claims` has no age filter or sort parameter | Requests `claim_status=Pending` with `limit/offset`; expects rows oldest first; table titled "Pending claims, oldest first" | Add `min_days_pending` and `sort` params |
| 15 | Paid amount (spec §6: only if `paid_amount` exists) | Unknown whether the data model has it | `paid_amount: number \| null`; when null the card says "Not available" and charts show submitted only | Confirm the column exists |
| 16 | Denial rate denominator (spec §7, acceptance test) | Not defined in the API | Response carries `eligible_claims`; the UI shows "Denied ÷ N claims" | Agree the denominator (all claims vs adjudicated) |
| 17 | Correlation IDs (spec §15) | No header defined in OpenAPI | Frontend sends `x-correlation-id` on every call (harmless if ignored) | Accept and log it |

## 4. Spec items intentionally not built (outside the existing screens)

AI Insights (§8), Reports screen (§9), Agent Monitor (§10), top header with notifications / user menu (§2), "Recent AI insights" widget on the Dashboard (§3), Angular Material (§0). The existing design uses a sidebar-only shell and plain components, so Material isn't added. The reports API **is** used, for Export CSV on AI Analytics.

## 5. Spec items implemented

- Routes from §2: `/dashboard`, `/ai-analytics`, `/admissions`, `/revenue`, `/claims` (+ `/history`). Old `/overview` and `/ask` redirect.
- Shared filter bar (hospital, department, payer, period, grouping) with options from `/api/metadata/*`; filters persist across screens.
- Content header with last-refreshed time and Refresh (§2).
- Loading skeletons, empty states, safe error messages with 401 / 403 / 422 / timeout handling, and no stack traces (§2, §15).
- KPI cards link to the matching detail screen with filters carried forward (§3).
- Chart contract validation with a table fallback when the type or fields are invalid (§14).
- Revenue never labels submitted amount as revenue (§6, appendix).
- Claims list shows aggregate fields only, with no patient identifiers (§7, §15).
- `x-session-id` header on analytics and report calls (OpenAPI).
