import { AskResponse, VisualizationSpec } from '../models/api.models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

const STATUS: Record<string, string> = {
  ok: 'success', success: 'success', completed: 'success',
  no_data: 'no_data', empty: 'no_data',
  clarify: 'clarification_needed', clarification: 'clarification_needed', clarification_needed: 'clarification_needed', needs_clarification: 'clarification_needed',
  blocked: 'blocked', rejected: 'blocked', forbidden: 'blocked', unsupported: 'blocked', refused: 'blocked',
  error: 'error', failed: 'error',
};
const UNIT: Record<string, string> = { percent: '%', percentage: '%', days: ' d', inr: '', currency_inr: '', count: '' };
const title = (k: string) => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/**
 * Converts the FastAPI /ask, /followup and /{query_id} response into the AskResponse the screens use.
 * Accepts both the real API shape (answer / visualization / table / plan / meta) and the
 * frontend-spec shape (insight / chart / applied_filters / execution_time_ms).
 */
export function normalizeAsk(raw: Raw): AskResponse {
  if (!raw || typeof raw !== 'object') return raw as AskResponse;
  const plan: Raw = raw['plan'] ?? {};
  const answer: Raw | string | undefined = raw['answer'];
  const meta: Raw = raw['meta'] ?? {};
  const table: Raw | undefined = raw['table'];

  // chart: `visualization` (real API) or `chart` (spec); fill the unit from the plan when missing
  let chart: VisualizationSpec | null = (raw['chart'] ?? raw['visualization'] ?? null) as VisualizationSpec | null;
  if (chart && typeof chart === 'object') {
    const unit = UNIT[String(plan['unit'] ?? '').toLowerCase()];
    chart = { ...chart, series: chart.series ?? [], data: chart.data ?? table?.['rows'] ?? [], options: { ...(chart.options ?? {}) } };
    if (unit && chart.options!.unit === undefined) chart.options!.unit = unit;
    if (chart.chartType === 'bar' && chart.options!.orientation === undefined && (chart.data?.length ?? 0) > 5) chart.options!.orientation = 'horizontal';
  }

  const rows: Raw[] = chart?.data ?? table?.['rows'] ?? [];
  const rawStatus = String(raw['status'] ?? (chart ? 'success' : 'error')).toLowerCase();
  let status = STATUS[rawStatus] ?? rawStatus;
  if (status === 'success' && rows.length === 0) status = 'no_data';

  const summary = typeof answer === 'string' ? answer : answer?.['summary'] ?? null;
  const insight = raw['insight'] ?? summary;

  // what was answered: from plan (real API) or applied_filters (spec)
  let applied: Record<string, string> | undefined = raw['applied_filters'];
  if (!applied && Object.keys(plan).length) {
    applied = {};
    if (plan['label'] ?? plan['metric']) applied['Metric'] = String(plan['label'] ?? title(plan['metric']));
    const dims: string[] = plan['dimensions'] ?? [];
    if (dims.length) applied['Grouped by'] = dims.map(title).join(' × ');
    const per = plan['period'];
    if (per?.from || per?.date_from) applied['Period'] = `${per.from ?? per.date_from} to ${per.to ?? per.date_to}`;
    for (const [k, v] of Object.entries(plan['filters'] ?? {})) {
      if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
      applied[title(k.replace(/_id$/, ''))] = Array.isArray(v) ? v.join(', ') : String(v);
    }
  }

  const per = plan['period'] ?? raw['reporting_period'];
  return {
    query_id: raw['query_id'],
    conversation_id: raw['conversation_id'],
    status,
    question: raw['question'] ?? '',
    metric: raw['metric'] ?? plan['metric'] ?? null,
    metric_label: raw['metric_label'] ?? plan['label'] ?? null,
    message: raw['message'] ?? raw['detail'] ?? (status !== 'success' ? summary : null) ?? null,
    chart,
    insight: status === 'success' ? insight : raw['insight'] ?? null,
    supporting_metrics: raw['supporting_metrics'] ?? [],
    comparisons: raw['comparisons'] ?? (typeof answer === 'object' ? answer?.['comparisons'] : undefined) ?? [],
    caveats: raw['caveats'] ?? (typeof answer === 'object' ? answer?.['caveats'] : undefined) ?? [],
    definition: plan['definition'] ?? null,
    table: table?.['rows'] ? { columns: table['columns'] ?? Object.keys(table['rows'][0] ?? {}), rows: table['rows'], row_count: table['row_count'], truncated: table['truncated'] } : null,
    reporting_period: per ? { date_from: per.date_from ?? per.from, date_to: per.date_to ?? per.to } : null,
    applied_filters: applied,
    row_count: raw['row_count'] ?? table?.['row_count'] ?? rows.length,
    execution_time_ms: raw['execution_time_ms'] ?? meta['duration_ms'] ?? null,
    created_at: raw['created_at'] ?? meta['created_at'],
    parent_query_id: raw['parent_query_id'] ?? null,
  };
}
