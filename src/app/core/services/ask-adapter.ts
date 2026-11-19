import { HistoryItem, HistoryResponse } from '../models/api.models';
import { AskResponse, VisualizationSpec } from '../models/api.models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const STATUS: Record<string, string> = {
  ok: 'success', success: 'success', completed: 'success',
  no_data: 'no_data', empty: 'no_data',
  clarify: 'clarification_needed', clarification: 'clarification_needed', clarification_needed: 'clarification_needed', needs_clarification: 'clarification_needed',
  blocked: 'blocked', rejected: 'blocked', forbidden: 'blocked', unsupported: 'blocked', refused: 'blocked',
  error: 'error', failed: 'error',
};
const UNIT: Record<string, string> = { percent: '%', percentage: '%', days: ' d', usd: '', currency: '', currency_usd: '', count: '' };
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
  let chart: VisualizationSpec | null = normalizeViz(raw['chart'] ?? raw['visualization'] ?? null, table);
  if (chart) {
    const unit = UNIT[String(plan['unit'] ?? '').toLowerCase()];
    if (unit && chart.options!.unit === undefined) chart.options!.unit = unit;
    // ISO period values ('2026-01-01') on the x-axis → 'Jan 26'
    const xk = chart.xKey;
    if (xk && chart.data.length && chart.data.every(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[xk])))) {
      const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      chart.data = chart.data.map(r => { const v = String(r[xk]); return { ...r, [xk]: `${M[+v.slice(5, 7) - 1]} ${v.slice(2, 4)}` }; });
    }
    if (chart.chartType === 'bar' && chart.options!.orientation === undefined && (chart.data?.length ?? 0) > 5) chart.options!.orientation = 'horizontal';
  }

  const rows: Raw[] = chart?.data ?? table?.['rows'] ?? [];
  const rawStatus = String(raw['status'] ?? (chart ? 'success' : 'error')).toLowerCase();
  let status = STATUS[rawStatus] ?? rawStatus;
  if (status === 'success' && rows.length === 0) status = 'no_data';

  const summary = typeof answer === 'string' ? answer : answer?.['summary'] ?? null;
  const insight = raw['insight'] ?? summary;

  // what was answered: from plan (real API) or applied_filters (spec). Every value goes through
  // readable(), because the plan can hold objects such as departments: [{ id, name }].
  let applied: Record<string, string> | undefined;
  if (raw['applied_filters'] && typeof raw['applied_filters'] === 'object') {
    applied = {};
    for (const [k, v] of Object.entries(raw['applied_filters'] as Record<string, unknown>)) { const t = readable(v); if (t) applied[k] = t; }
  } else if (Object.keys(plan).length) {
    applied = {};
    const metric = readable(plan['label']) || metricLabel(plan['metric']);
    if (metric) applied['Metric'] = metric;
    const dims = readable(plan['dimensions'], title, ' × ');
    if (dims) applied['Grouped by'] = dims;
    const per = plan['period'];
    if (per?.from || per?.date_from) applied['Period'] = `${per.from ?? per.date_from} to ${per.to ?? per.date_to}`;
    for (const [k, v] of Object.entries(plan['filters'] ?? {})) {
      const t = readable(v);
      if (t) applied[title(k.replace(/_ids?$/, ''))] = t;
    }
  }

  const per = plan['period'] ?? raw['reporting_period'];
  return {
    query_id: raw['query_id'],
    conversation_id: raw['conversation_id'],
    status,
    question: raw['question'] ?? '',
    metric: raw['metric'] ?? plan['metric'] ?? null,
    metric_label: readable(raw['metric_label'] ?? plan['label']) || metricLabel(plan['metric']) || null,
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
    created_at: toIso(raw['created_at'] ?? meta['created_at']),
    parent_query_id: raw['parent_query_id'] ?? null,
  };
}

/** ISO string, or epoch seconds / milliseconds (number or numeric string) → ISO string. */
export function toIso(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : /^\d+(\.\d+)?$/.test(String(v)) ? +v : NaN;
  if (!isNaN(n)) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  const s = String(v);
  // naive timestamps from the API are UTC
  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? s.replace(' ', 'T') + 'Z' : s;
}

/** GET /api/analytics/history → HistoryResponse, accepting the API's field names. */
export function normalizeHistory(raw: unknown, limit: number, offset: number): HistoryResponse {
  const r = (raw ?? {}) as Record<string, any>;
  const list: Record<string, any>[] = Array.isArray(raw) ? raw : r['items'] ?? r['rows'] ?? r['data'] ?? r['history'] ?? r['queries'] ?? [];
  const items: HistoryItem[] = list.map(i => {
    const plan = i['plan'] ?? {};
    const meta = i['meta'] ?? {};
    const st = String(i['status'] ?? '').toLowerCase();
    return {
      query_id: i['query_id'] ?? i['id'] ?? '',
      conversation_id: i['conversation_id'] ?? '',
      parent_query_id: i['parent_query_id'] ?? null,
      question: i['question'] ?? i['query'] ?? i['text'] ?? '',
      status: STATUS[st] ?? st,
      metric_label: readable(i['metric_label'] ?? i['metric_name'] ?? plan['label']) || metricLabel(i['metric'] ?? plan['metric']) || null,
      scope_label: i['scope_label'] ?? null,
      row_count: firstNumber(i['row_count'], i['rows_returned'], i['result_rows'], i['result_count'], i['rows'], i['table']?.['row_count'], i['result']?.['row_count'], meta['row_count']),
      execution_time_ms: firstNumber(i['execution_time_ms'], i['duration_ms'], meta['duration_ms'], i['latency_ms'], i['elapsed_ms'], i['total_ms'], meta['elapsed_ms'], i['timings']?.['total_ms'])
        ?? secondsToMs(firstNumber(i['duration_seconds'], i['duration_s'], meta['duration_seconds'])),
      created_at: toIso(i['created_at'] ?? i['asked_at'] ?? i['timestamp'] ?? i['ts'] ?? i['time']),
    };
  });
  const total = r['total'] ?? r['count'] ?? r['total_count'] ?? r['total_items'] ?? (items.length < limit ? offset + items.length : null);
  return { items, total: total ?? offset + items.length, limit: r['limit'] ?? limit, offset: r['offset'] ?? offset };
}

/**
 * Any plan value → display text. Strings and numbers as they are; objects by their name/label
 * (falling back to id/code); lists joined. Returns '' for empty values so the row is skipped.
 */
export function readable(v: unknown, fmt: (s: string) => string = s => s, sep = ', '): string {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.map(x => readable(x, fmt, sep)).filter(Boolean).join(sep);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const pick = ['name', 'label', 'display_name', 'title', 'department_name', 'hospital_name', 'payer_name', 'value', 'id', 'code']
      .map(k => o[k]).find(x => typeof x === 'string' || typeof x === 'number');
    if (pick !== undefined) return fmt(String(pick));
    // e.g. { from, to } or { relative: 'last_2_months' }: show its plain values
    return Object.values(o).filter(x => typeof x === 'string' || typeof x === 'number').map(x => fmt(String(x))).join(' – ');
  }
  return fmt(String(v));
}

/** First argument that is a finite number (numeric strings count), else null. */
function firstNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}
const secondsToMs = (s: number | null) => (s === null ? null : Math.round(s * 1000));

/** Display names for metric keys the API returns without a label. */
const METRIC_LABELS: Record<string, string> = {
  admissions: 'Admissions', unique_patients: 'Unique patients', claims: 'Claims', claim_amount: 'Claim amount',
  denial_rate: 'Denial rate', denial_rate_decided: 'Denial rate (decided claims)', denied_claims: 'Denied claims',
  avg_length_of_stay: 'Avg length of stay', avg_los: 'Avg length of stay', pending_claims: 'Pending claims',
  pending_over_30d: 'Pending over 30 days', pending_amount: 'Pending amount', paid_amount: 'Paid amount',
  denied_amount: 'Denied amount', patient_days: 'Patient days', bed_utilization_pct: 'Bed utilisation',
};
export function metricLabel(key: unknown): string {
  const k = readable(key);
  if (!k) return '';
  return METRIC_LABELS[k] ?? k.replace(/_(\d+)d$/, ' over $1 days').replace(/_pct$/, ' %').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

/* ------------------------------------------------------------------ visualization
 * The chart agent doesn't always use the frontend chart contract (chartType / xKey / seriesKey /
 * series[{dataKey,label}]). Map the other common shapes onto it so a valid chart is drawn instead of nothing:
 *   y / yKey / valueKey / dataKey / metric / yKeys[] / series: 'col' | ['col']  → series
 *   groupBy / colorKey / group / category / (heatmap) yKey                      → seriesKey
 *   x / categoryKey / labelKey / first text column                              → xKey
 *   stacked_bar, grouped_bar, horizontal_bar, column, area, multi_line, donut… → supported types + options
 */
const TYPE_ALIASES: Record<string, { type: string; options?: Record<string, unknown> }> = {
  bar: { type: 'bar' }, column: { type: 'bar' }, columns: { type: 'bar' }, grouped_bar: { type: 'bar' }, clustered_bar: { type: 'bar' },
  stacked_bar: { type: 'bar', options: { stacked: true } }, stacked_column: { type: 'bar', options: { stacked: true } },
  horizontal_bar: { type: 'bar', options: { orientation: 'horizontal' } }, barh: { type: 'bar', options: { orientation: 'horizontal' } },
  line: { type: 'line' }, multi_line: { type: 'line' }, multiline: { type: 'line' }, time_series: { type: 'line' }, timeseries: { type: 'line' },
  area: { type: 'line', options: { area: true } }, stacked_area: { type: 'line', options: { area: true, stacked: true } },
  pie: { type: 'pie' }, donut: { type: 'pie', options: { donut: true } }, doughnut: { type: 'pie', options: { donut: true } },
  heatmap: { type: 'heatmap' }, heat_map: { type: 'heatmap' }, sankey: { type: 'sankey' }, funnel: { type: 'funnel' },
  gauge: { type: 'gauge' }, kpi: { type: 'gauge' }, boxplot: { type: 'boxplot' }, box_plot: { type: 'boxplot' }, table: { type: 'table' },
};

function normalizeViz(v: unknown, table: Raw | undefined): VisualizationSpec | null {
  if (!v || typeof v !== 'object') {
    if (!Array.isArray(table?.['rows']) || !table!['rows'].length) return null;
    v = { chartType: 'table' };   // no chart sent: start from the table and let autoChart pick one
  }
  const s = v as Raw;
  const data: Raw[] = Array.isArray(s['data']) ? s['data'] : Array.isArray(table?.['rows']) ? table!['rows'] : [];
  const cols: string[] = data.length ? Object.keys(data[0]) : (table?.['columns'] ?? []);
  const isNum = (c: string) => data.length > 0 && data.every(r => r[c] === null || r[c] === undefined || (typeof r[c] === 'number') || (typeof r[c] === 'string' && r[c].trim() !== '' && !isNaN(+r[c])));
  const has = (c: unknown): c is string => typeof c === 'string' && (cols.length === 0 || cols.includes(c));

  const rawType = String(s['chartType'] ?? s['chart_type'] ?? s['type'] ?? 'bar').toLowerCase().replace(/[\s-]+/g, '_');
  const alias = TYPE_ALIASES[rawType];
  const chartType = (alias?.type ?? rawType) as VisualizationSpec['chartType'];
  const heat = chartType === 'heatmap';

  const xKey = [s['xKey'], s['x'], s['x_key'], s['categoryKey'], s['labelKey'], s['dimension']].find(has)
    ?? cols.find(c => !isNum(c));
  const groupCandidates = [s['seriesKey'], s['series_key'], s['groupBy'], s['group_by'], s['colorKey'], s['color'], s['group'], s['category'], heat ? (s['yKey'] ?? s['y']) : undefined];
  let seriesKey = groupCandidates.find(c => has(c) && c !== xKey && !isNum(c as string)) as string | undefined;

  // the measure(s)
  let series: { dataKey: string; label?: string }[] = [];
  const raw = s['series'];
  if (Array.isArray(raw) && raw.length) {
    series = raw.map((x: unknown) => (typeof x === 'string' ? { dataKey: x } : (x as Raw)))
      .map((x: Raw) => ({ dataKey: x['dataKey'] ?? x['key'] ?? x['field'] ?? x['y'] ?? x['name'], label: x['label'] ?? x['name'] }))
      .filter(x => typeof x.dataKey === 'string' && has(x.dataKey));
  } else if (typeof raw === 'string' && has(raw)) {
    series = [{ dataKey: raw }];
  }
  if (!series.length) {
    const yKeys = [s['yKeys'], s['y_keys'], s['valueKeys']].find(Array.isArray) as string[] | undefined;
    const single = [heat ? undefined : s['yKey'], heat ? undefined : s['y'], s['valueKey'], s['value_key'], s['value'], s['dataKey'], s['measure'], s['metric']].find(c => has(c) && isNum(c as string));
    const picks = yKeys?.filter(c => has(c)) ?? (single ? [single as string] : cols.filter(c => c !== xKey && c !== seriesKey && isNum(c)).slice(0, seriesKey ? 1 : 3));
    series = picks.map(c => ({ dataKey: c, label: title(c) }));
  }
  // heatmap / long data with a second text column but no group named: use it as the group
  if (!seriesKey && (heat || (series.length === 1 && chartType !== 'pie'))) {
    seriesKey = cols.find(c => c !== xKey && !isNum(c) && !series.some(x => x.dataKey === c) && new Set(data.map(r => r[c])).size < data.length);
  }

  const spec = {
    ...(s as unknown as VisualizationSpec),
    chartType, xKey, seriesKey,
    series: series.map(x => ({ dataKey: x.dataKey, label: x.label ?? title(x.dataKey) })),
    data,
    options: { ...(alias?.options ?? {}), ...((s['options'] as Raw) ?? {}) },
  } as VisualizationSpec;
  return spec.chartType === 'table' ? autoChart(spec, cols, isNum) : spec;
}

/**
 * The API sometimes answers with chartType "table" (or no chart). When the rows can be charted, pick a chart
 * the way the chart contract would; the Table tab still shows every row. Otherwise keep the table.
 *   time × measure                       → line
 *   time × group × measure, ≤ 6 groups   → multi-line;  more groups → heatmap (group × period)
 *   category × measure                   → bar (horizontal above 5 bars)
 *   category × group × measure, ≤ 4 grp  → grouped bar; more → heatmap
 */
function autoChart(spec: VisualizationSpec, cols: string[], isNum: (c: string) => boolean): VisualizationSpec {
  const data = spec.data ?? [];
  const textCols = cols.filter(c => !isNum(c));
  const measure = spec.series?.[0]?.dataKey ?? cols.find(c => isNum(c));
  if (!data.length || !measure || data.length > 500) return spec;
  const isTime = (c: string) => /period|month|week|quarter|date|year|day/i.test(c) || data.every(r => /^\d{4}-\d{2}/.test(String(r[c])));
  const x = (spec.xKey && textCols.includes(spec.xKey) ? spec.xKey : undefined) ?? textCols.find(isTime) ?? textCols[0];
  if (!x) return spec;
  const group = spec.seriesKey && spec.seriesKey !== x ? spec.seriesKey : textCols.find(c => c !== x);
  const time = isTime(x);
  const nGroups = group ? new Set(data.map(r => r[group])).size : 0;
  const nX = new Set(data.map(r => r[x])).size;
  const series = spec.series?.length ? spec.series : [{ dataKey: measure, label: title(measure) }];
  let chartType: VisualizationSpec['chartType'];
  let options: VisualizationSpec['options'] = { ...(spec.options ?? {}) };
  if (!group || nGroups <= 1) {
    if (nX < 2 && !time) return spec;
    chartType = time ? 'line' : 'bar';
    if (!time && nX > 5) options = { ...options, orientation: 'horizontal' };
    if (time) options = { ...options, markPeak: true };
  } else if (time ? nGroups <= 6 : nGroups <= 4) {
    chartType = time ? 'line' : 'bar';
  } else {
    chartType = 'heatmap';
  }
  return { ...spec, chartType, xKey: x, seriesKey: group && nGroups > 1 ? group : undefined, series: series.slice(0, 1), options };
}
