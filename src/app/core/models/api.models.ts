// ============================================================================
// Wire contracts for the Smart Healthcare Analytics API (OpenAPI 3.1, v1.0.0).
//
// REQUESTS follow the OpenAPI spec exactly (snake_case query params, array
// filters, AskRequest / FollowupRequest / ExportRequest bodies).
//
// RESPONSES: the OpenAPI spec declares every 200 response as a free-form
// `object`, so the shapes below are the PROPOSED contract. Envelopes are
// snake_case (as in the frontend spec's /ask example); chart objects use the
// camelCase chart contract from section 14 of the frontend spec. The backend
// should publish these as Pydantic `response_model`s so OpenAPI documents them.
// ============================================================================

// ---------------------------------------------------------------- filters ---
/** Pattern from OpenAPI: ^[A-Za-z]{1,3}\d{1,4}$, max 8 chars, max 12 items. */
export type EntityId = string;
export type Granularity = 'week' | 'month' | 'quarter';
export type ClaimStatus = 'Paid' | 'Denied' | 'Pending';
export type ClaimType = 'Primary' | 'Secondary';
export type GroupBy = 'hospital' | 'department' | 'payer';

/** Common dashboard query parameters (identical on every /api/dashboard/* path). */
export interface DashboardFilters {
  date_from: string | null;           // YYYY-MM-DD, inclusive
  date_to: string | null;             // YYYY-MM-DD, inclusive
  hospital_id: EntityId[];            // empty = all hospitals in the user's scope
  department_id: EntityId[];
  payer_id: EntityId[];               // claim metrics only
  claim_status?: ClaimStatus[];
  claim_type?: ClaimType[];
}

/** AskRequest.filters / ExportRequest.filters (no claim_status / claim_type). */
export interface AskFilters {
  date_from?: string | null;
  date_to?: string | null;
  hospital_id?: EntityId[] | null;
  department_id?: EntityId[] | null;
  payer_id?: EntityId[] | null;
}

// --------------------------------------------------------------- charts -----
export type ChartType =
  | 'line' | 'bar' | 'pie' | 'heatmap' | 'sankey' | 'funnel' | 'gauge' | 'boxplot' | 'table';

export interface SeriesDef { dataKey: string; label: string }

/** Chart contract (frontend spec §14). Shared by dashboard endpoints and /ask. */
export interface VisualizationSpec {
  chartType: ChartType;
  title: string;
  xKey?: string;
  /** Optional second dimension in long-format data (e.g. month × department). */
  seriesKey?: string;
  series: SeriesDef[];
  data: Record<string, string | number | null>[];
  options?: {
    orientation?: 'vertical' | 'horizontal';
    stacked?: boolean;
    unit?: string;              // '%', ' d', ' Cr' …
    target?: number;
    max?: number;
    highlightAbove?: number;
    area?: boolean;
    markPeak?: boolean;
    donut?: boolean;
  };
}

// -------------------------------------------------------------- metadata ----
export interface NamedEntity { id: EntityId; name: string }
export interface MetricDef { key: string; label: string; unit?: string; description?: string }
/** /api/metadata/* — service accepts either a bare array or `{ items: [...] }`. */
export type ListEnvelope<T> = T[] | { items: T[] };

export interface HealthResponse { status: string; [k: string]: unknown }

// ------------------------------------------------------------- dashboard ----
export type KpiUnit = 'count' | 'currency_inr' | 'percent' | 'days' | 'decimal';

export interface Kpi {
  key: string;
  label: string;
  value: number | null;            // null = not available in the data model
  unit: KpiUnit;
  note?: string;
  change?: { label: string; direction: 'up' | 'down' | 'flat'; favourable: boolean } | null;
  sparkline?: number[];
}

export interface ReportingPeriod { date_from: string; date_to: string }

/** GET /api/dashboard/summary */
export interface SummaryResponse {
  period: ReportingPeriod;
  comparison_label?: string;
  last_refreshed?: string;
  kpis?: Kpi[];
}

/** GET /api/dashboard/admissions — chart keys used by the screens:
 *  trend, by_department, by_hospital, los_by_department, department_heatmap,
 *  daily_trend, weekday_distribution. */
export interface AdmissionsResponse {
  period: ReportingPeriod;
  granularity: Granularity;
  totals?: {
    total_admissions: number;
    admissions_per_day: number | null;
    unique_patients?: number | null;
    avg_los_days: number;
    top_department: { name: string; admissions: number; share: number } | null;
    peak_period: { label: string; admissions: number } | null;
  };
  charts?: Partial<Record<string, VisualizationSpec>>;
  last_refreshed?: string;
}

/** GET /api/dashboard/revenue — chart keys: monthly_by_status, by_payer_status,
 *  pending_by_payer, status_mix. Amounts are INR. */
export interface RevenueResponse {
  period: ReportingPeriod;
  totals?: {
    submitted_amount: number;
    /** null when the data model has no paid/remittance amount (spec §6). */
    paid_amount: number | null;
    pending_amount: number;
    denied_amount: number;
    currency: 'INR';
  };
  charts?: Partial<Record<string, VisualizationSpec>>;
  last_refreshed?: string;
}

export interface ClaimRow {
  claim_id: string;
  hospital_name: string;
  department_name: string;
  payer_name: string;
  claim_amount: number;
  status: ClaimStatus;
  days_pending: number | null;
  aging_band: string | null;
}

/** GET /api/dashboard/claims (paged with limit / offset) — chart keys:
 *  status_distribution, outcomes_by_payer, pending_aging. */
export interface ClaimsResponse {
  /** payer_id → pending claim count (from the claims endpoint's by_payer) */
  pending_by_payer?: Record<string, number>;
  period: ReportingPeriod;
  totals?: {
    total_claims: number;
    approved_claims: number;
    denied_claims: number;
    pending_claims: number;
    pending_over_30_days: number;
  };
  charts?: Partial<Record<string, VisualizationSpec>>;
  items?: ClaimRow[];
  total: number;
  limit: number;
  offset: number;
  last_refreshed?: string;
}

export interface PayerDenialRow {
  payer_id: EntityId;
  payer_name: string;
  total_claims: number;
  denied_claims: number;
  pending_claims: number | null;
  denial_rate: number; // percent
}

export interface DenialReason { code: string; description: string; count: number; share: number; amount?: number | null }

/** GET /api/dashboard/denials — chart keys: by_payer, by_reason, by_department. */
export interface DenialsResponse {
  period: ReportingPeriod;
  totals?: { denied_claims: number; eligible_claims: number; denial_rate: number; target_rate: number | null };
  definition?: string | null;
  by_payer?: PayerDenialRow[];
  reasons?: DenialReason[];
  charts?: Partial<Record<string, VisualizationSpec>>;
  last_refreshed?: string;
}

/** GET /api/dashboard/hospitals and /api/dashboard/departments */
export interface DimensionRow {
  id: EntityId;
  name: string;
  admissions: number;
  avg_los_days: number;
  total_claims: number;
  denied_claims: number;
  denial_rate: number;
  submitted_amount: number;
  paid_amount: number | null;
  pending_amount: number;
  denied_amount: number;
}
export interface DimensionResponse { period: ReportingPeriod; rows: DimensionRow[] }

/** GET /api/dashboard/trends?metric=&group_by= */
export interface TrendsResponse {
  metric: string;
  granularity: Granularity;
  group_by: GroupBy | null;
  chart: VisualizationSpec;
}

// ------------------------------------------------------------- analytics ----
/** POST /api/analytics/ask body (OpenAPI AskRequest). */
export interface AskRequest {
  question: string;                 // maxLength 500
  filters?: AskFilters | null;
  conversation_id?: string | null;  // uuid
}

/** POST /api/analytics/followup body (OpenAPI FollowupRequest). */
export interface FollowupRequest {
  conversation_id: string;          // uuid, required
  question: string;                 // maxLength 500
}

export type AskStatus = 'success' | 'no_data' | 'clarification_needed' | 'blocked' | 'error';

/** Response of /ask, /followup and GET /api/analytics/{query_id} (spec §4). */
export interface AskResponse {
  query_id: string;
  conversation_id: string;
  status: AskStatus | string;
  question: string;
  metric?: string | null;
  metric_label?: string | null;
  message?: string | null;          // why it was blocked / what to clarify
  chart?: VisualizationSpec | null;
  insight?: string | null;
  supporting_metrics?: { label: string; value: string }[];
  reporting_period?: ReportingPeriod | null;
  applied_filters?: Record<string, string>;
  row_count?: number | null;
  execution_time_ms?: number | null;
  created_at?: string;
  parent_query_id?: string | null;
  /** From the real API's answer block. */
  comparisons?: string[];
  caveats?: string[];
  /** Metric definition, e.g. "Denied claims divided by ALL claims filed in the period". */
  definition?: string | null;
  /** Full result table (all columns), when the API returns one. */
  table?: { columns: string[]; rows: Record<string, string | number | null>[]; row_count?: number; truncated?: boolean } | null;
}

export interface HistoryItem {
  query_id: string;
  conversation_id: string;
  parent_query_id?: string | null;
  question: string;
  status: AskStatus | string;
  metric_label?: string | null;
  scope_label?: string | null;
  row_count?: number | null;
  execution_time_ms?: number | null;
  created_at: string;
}

/** GET /api/analytics/history?limit=&offset= */
export interface HistoryResponse { items: HistoryItem[]; total: number; limit: number; offset: number }

// --------------------------------------------------------------- reports ----
/** POST /api/reports/export body (OpenAPI ExportRequest). */
export interface ExportRequest {
  source: 'analytics' | 'dashboard';
  format?: 'csv' | 'json';
  query_id?: string | null;
  dashboard?: 'summary' | 'admissions' | 'revenue' | 'claims' | 'denials' | 'departments' | 'hospitals' | 'trends' | null;
  section?: string | null;
  filters?: AskFilters | null;
  granularity?: Granularity;
  metric?: string | null;
  group_by?: GroupBy | null;
}

export type ReportStatus = 'queued' | 'processing' | 'completed' | 'failed';
export interface ReportResponse {
  report_id: string;
  status: ReportStatus;
  format: 'csv' | 'json';
  file_name?: string;
  created_at?: string;
  completed_at?: string;
  expires_at?: string;
  row_count?: number;
  size_bytes?: number;
  error?: string | null;
}

// ---------------------------------------------------------------- agents ----
/** GET /api/agents, /api/agents/{name} (open objects in the OpenAPI spec). */
export interface AgentInfo {
  name: string;
  display_name?: string;
  version?: string;
  sha256?: string;
  description?: string;
  role?: string;
  responsibilities?: string[];
  inputs?: unknown;
  outputs?: unknown;
  file?: string;
  model?: string;
  status?: string;
  loaded_at?: string;
  raw?: unknown;
}
export interface AgentInstructions { name: string; content: string; file?: string; version?: string; sha256?: string; frontmatter?: Record<string, unknown> }
export interface ExecutionStep {
  name: string;
  kind?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration_ms?: number;
  version?: string;
  sha256?: string;
  detail?: string;
}
/** POST /api/agents/{name}/execute, read tolerantly. */
export interface AgentExecution {
  agent: string; ok: boolean; status: string; duration_ms: number; measured_by: 'server' | 'browser';
  correlation_id?: string; output: unknown; error?: string; steps: ExecutionStep[]; at: string;
}
/** The latest AI Analytics run, from its meta block. */
export interface PipelineRun {
  query_id: string; question: string; status: string; ok: boolean; created_at?: string;
  duration_ms: number | null; correlation_id: string | null; steps: ExecutionStep[]; error: string | null;
}

// ---------------------------------------------------------------- errors ----
/** FastAPI 422 body (OpenAPI HTTPValidationError). */
export interface HttpValidationError {
  detail: { loc: (string | number)[]; msg: string; type: string }[];
}
