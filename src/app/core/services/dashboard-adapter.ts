// Converts the FastAPI dashboard responses (raw aggregates: totals, trend, by_* lists) into the
// screen models in api.models.ts, building the chart specs here. Responses already in the screen
// format (the mock: they carry `charts`) pass through unchanged.
// Only mapping and labelling happen here; no business measures are calculated in the browser.
import {
  AdmissionsResponse, ClaimRow, ClaimsResponse, DenialsResponse, DimensionResponse, DimensionRow, Granularity, Kpi,
  KpiUnit, ReportingPeriod, RevenueResponse, SummaryResponse, TrendsResponse, VisualizationSpec,
} from '../models/api.models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cr = (v: unknown) => (typeof v === 'number' ? Math.round((v / 1e7) * 100) / 100 : null); // ₹ → crore, 2 dp
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v : []);

/** '2026-01-01' → 'Jan' / 'Jan 2026' (month), '5 Jan' (week), 'Q1 2026' (quarter). */
export function periodLabel(p: unknown, g: Granularity | string | null | undefined, multiYear = false): string {
  const s = String(p ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  if (g === 'quarter') return `Q${Math.floor(mo / 3) + 1} ${y}`;
  if (g === 'week') return `${d} ${MONTHS[mo]}`;
  return multiYear ? `${MONTHS[mo]} ${String(y).slice(2)}` : MONTHS[mo];
}
const spansYears = (rows: Raw[]) => new Set(rows.map(r => String(r['period'] ?? '').slice(0, 4))).size > 1;

function period(raw: Raw): ReportingPeriod {
  const p = raw['period'] ?? {};
  return { date_from: p.date_from ?? p.from ?? '', date_to: p.date_to ?? p.to ?? '' };
}

const UNIT: Record<string, KpiUnit> = { count: 'count', currency: 'currency_inr', currency_inr: 'currency_inr', inr: 'currency_inr', percent: 'percent', percentage: 'percent', days: 'days', decimal: 'decimal' };

/** '2026-05-01','2026-07-31' → 'May – Jul 2026'; partial months keep the day: '5 May – 20 Jul 2026'. */
export function rangeLabel(from: unknown, to: unknown): string {
  const p = (v: unknown) => /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  const a = p(from), b = p(to);
  if (!a || !b) return [from, to].filter(Boolean).join(' – ');
  const [ay, am, ad] = [+a[1], +a[2] - 1, +a[3]], [by, bm, bd] = [+b[1], +b[2] - 1, +b[3]];
  const lastDay = new Date(by, bm + 1, 0).getDate();
  const whole = ad === 1 && bd === lastDay;
  const left = (whole ? MONTHS[am] : `${ad} ${MONTHS[am]}`) + (ay !== by ? ` ${ay}` : '');
  const right = (whole ? MONTHS[bm] : `${bd} ${MONTHS[bm]}`) + ` ${by}`;
  return ay === by && am === bm && whole ? `${MONTHS[am]} ${ay}` : `${left} – ${right}`;
}

// ------------------------------------------------------------------ summary
export function normalizeSummary(raw: Raw): SummaryResponse {
  if (!raw) return raw;
  const comp = raw['comparison'];
  const comparison_label = raw['comparison_label']
    ?? (comp?.available ? `vs ${rangeLabel(comp.from ?? comp.date_from, comp.to ?? comp.date_to)}` : comp?.note ? 'No comparison period' : '');
  const kpis: Kpi[] = arr(raw['kpis']).map(k => {
    const unit: KpiUnit = UNIT[String(k['unit'] ?? '').toLowerCase()] ?? 'count';
    let change = k['change'] ?? null;
    if (!change && k['change_available'] && typeof k['change_pct'] === 'number') {
      const up = k['change_pct'] >= 0;
      const good = k['higher_is_better'] === false ? !up : up;
      const label = unit === 'percent' && typeof k['change_abs'] === 'number'
        ? `${up ? '+' : ''}${k['change_abs'].toFixed(1)} pts` : `${up ? '+' : ''}${k['change_pct'].toFixed(1)}%`;
      change = { label, direction: k['change_pct'] === 0 ? 'flat' : up ? 'up' : 'down', favourable: good };
    }
    const label = k['key'] === 'claim_amount' ? 'Claim amount (submitted)' : k['label'];
    const note = k['note'] ?? (typeof k['target'] === 'number' ? `Target ${k['target']}${unit === 'percent' ? '%' : ''}` : k['key'] === 'claim_amount' ? 'Billed, not revenue' : undefined);
    return {
      key: k['key'], label, value: k['value'] ?? null, unit, note, change,
      sparkline: k['sparkline'] ?? arr(k['trend']).map(p => p['value']).filter((v: unknown) => typeof v === 'number'),
    };
  });
  return { period: period(raw), comparison_label, last_refreshed: raw['last_refreshed'] ?? raw['generated_at'], kpis };
}

// --------------------------------------------------------------- admissions
export function normalizeAdmissions(raw: Raw): AdmissionsResponse {
  if (!raw || raw['charts']) return raw as AdmissionsResponse;
  const g: Granularity = raw['granularity'] ?? 'month';
  const t = raw['totals'] ?? {};
  const trend = arr(raw['trend']);
  const multi = spansYears(trend);
  const depts = arr(raw['by_department']);
  const hosps = arr(raw['by_hospital']);
  const top = depts[0];
  const cells = arr(raw['department_month_heatmap']?.['cells']);
  const heatMulti = spansYears(cells);

  const charts: Record<string, VisualizationSpec> = {
    trend: {
      chartType: 'line', title: `${g === 'week' ? 'Weekly' : g === 'quarter' ? 'Quarterly' : 'Monthly'} admissions`, xKey: 'period',
      series: [{ dataKey: 'admissions', label: 'Admissions' }],
      data: trend.map(r => ({ period: periodLabel(r['period'], g, multi), admissions: r['admissions'] ?? null })),
      options: { area: true, markPeak: true },
    },
    by_department: {
      chartType: 'bar', title: 'Admissions by department', xKey: 'department', series: [{ dataKey: 'admissions', label: 'Admissions' }],
      data: depts.map(d => ({ department: d['department_name'], admissions: d['suppressed'] ? null : d['admissions'] })), options: { orientation: 'horizontal' },
    },
    by_hospital: {
      chartType: 'bar', title: 'Admissions by hospital', xKey: 'hospital', series: [{ dataKey: 'admissions', label: 'Admissions' }],
      data: hosps.map(h => ({ hospital: h['hospital_name'], admissions: h['suppressed'] ? null : h['admissions'] })), options: { orientation: 'horizontal' },
    },
    los_by_department: {
      chartType: 'bar', title: 'Average length of stay by department', xKey: 'department', series: [{ dataKey: 'avg_los', label: 'Avg LOS (days)' }],
      data: [...depts].filter(d => typeof d['avg_length_of_stay'] === 'number').sort((a, b) => b['avg_length_of_stay'] - a['avg_length_of_stay'])
        .map(d => ({ department: d['department_name'], avg_los: d['avg_length_of_stay'] })),
      options: { orientation: 'horizontal', unit: ' d', target: typeof t['avg_length_of_stay'] === 'number' ? t['avg_length_of_stay'] : undefined },
    },
  };
  if (cells.length) {
    charts['department_heatmap'] = {
      chartType: 'heatmap', title: `Admissions, department × ${g}`, xKey: 'month', seriesKey: 'department',
      series: [{ dataKey: 'admissions', label: 'Admissions' }],
      data: cells.map(c => ({ month: periodLabel(c['period'], g, heatMulti), department: c['department_name'], admissions: c['suppressed'] ? null : c['value'] })),
    };
  }
  const peak = raw['peak'];
  return {
    period: period(raw), granularity: g, last_refreshed: raw['generated_at'], charts,
    totals: {
      total_admissions: t['admissions'] ?? t['total_admissions'] ?? 0,
      admissions_per_day: t['admissions_per_day'] ?? null as unknown as number,
      unique_patients: t['unique_patients'] ?? null,
      avg_los_days: t['avg_length_of_stay'] ?? t['avg_los_days'] ?? 0,
      top_department: top ? { name: top['department_name'], admissions: top['admissions'], share: top['share_pct'] } : null,
      peak_period: peak ? { label: periodLabel(peak['period'], g, true).replace(/^(\w{3}) (\d{2})$/, '$1 20$2'), admissions: peak['admissions'] } : null,
    },
  };
}

// ------------------------------------------------------------------ revenue
export function normalizeRevenue(raw: Raw): RevenueResponse {
  if (!raw || raw['charts']) return raw as RevenueResponse;
  const g = raw['granularity'] ?? 'month';
  const t = raw['totals'] ?? {};
  const trend = arr(raw['trend']);
  const multi = spansYears(trend);
  const payers = arr(raw['by_payer']);
  const outcome = (rows: Raw[], key: string, label: string) => rows.map(r => ({ [key]: r[label], Paid: cr(r['paid_amount']), Pending: cr(r['pending_amount']), Denied: cr(r['denied_amount']) }));
  const stack = [{ dataKey: 'Paid', label: 'Paid' }, { dataKey: 'Pending', label: 'Pending' }, { dataKey: 'Denied', label: 'Denied' }];
  const subPaid = (rows: Raw[], key: string, label: string): VisualizationSpec['data'] =>
    rows.map(r => ({ [key]: r[label], Submitted: cr(r['claim_amount']), Paid: cr(r['paid_amount']) }));
  const hasPaid = typeof t['paid_amount'] === 'number';
  const sp = hasPaid ? [{ dataKey: 'Submitted', label: 'Submitted' }, { dataKey: 'Paid', label: 'Paid' }] : [{ dataKey: 'Submitted', label: 'Submitted' }];

  return {
    period: period(raw), last_refreshed: raw['generated_at'],
    totals: {
      submitted_amount: t['claim_amount'] ?? t['submitted_amount'] ?? 0,
      paid_amount: hasPaid ? t['paid_amount'] : null,
      pending_amount: t['pending_amount'] ?? 0,
      denied_amount: t['denied_amount'] ?? 0,
      currency: 'INR',
    },
    charts: {
      monthly_by_status: {
        chartType: 'bar', title: 'Claim amount by outcome (₹ Cr)', xKey: 'period', series: stack,
        data: trend.map(r => ({ period: periodLabel(r['period'], g, multi), Paid: cr(r['paid_amount']), Pending: cr(r['pending_amount']), Denied: cr(r['denied_amount']) })),
        options: { stacked: true, unit: ' Cr' },
      },
      by_payer_status: { chartType: 'bar', title: 'Claim amount by payer and outcome (₹ Cr)', xKey: 'payer', series: stack, data: outcome(payers, 'payer', 'payer_name'), options: { stacked: true, orientation: 'horizontal', unit: ' Cr' } },
      pending_by_payer: {
        chartType: 'bar', title: 'Pending claim amount by payer (₹ Cr)', xKey: 'payer', series: [{ dataKey: 'Pending', label: 'Pending' }],
        data: [...payers].sort((a, b) => (b['pending_amount'] ?? 0) - (a['pending_amount'] ?? 0)).map(r => ({ payer: r['payer_name'], Pending: cr(r['pending_amount']) })),
        options: { orientation: 'horizontal', unit: ' Cr' },
      },
      status_mix: {
        chartType: 'pie', title: 'Total claim amount by outcome (₹ Cr)', xKey: 'status', series: [{ dataKey: 'amount', label: '₹ Cr' }],
        data: [{ status: 'Paid', amount: cr(t['paid_amount']) }, { status: 'Pending', amount: cr(t['pending_amount']) }, { status: 'Denied', amount: cr(t['denied_amount']) }].filter(r => r.amount !== null),
        options: { donut: true, unit: ' Cr' },
      },
      by_hospital: { chartType: 'bar', title: 'Submitted vs paid by hospital (₹ Cr)', xKey: 'hospital', series: sp, data: subPaid(arr(raw['by_hospital']), 'hospital', 'hospital_name'), options: { orientation: 'horizontal', unit: ' Cr' } },
      by_department: { chartType: 'bar', title: 'Submitted vs paid by department (₹ Cr)', xKey: 'department', series: sp, data: subPaid(arr(raw['by_department']), 'department', 'department_name'), options: { unit: ' Cr' } },
    },
  };
}

// ----------------------------------------------------------- dimension rows
export function normalizeDimension(raw: Raw, kind: 'hospital' | 'department'): DimensionResponse {
  if (!raw) return raw;
  const rows: DimensionRow[] = arr(raw['rows']).map(r => ({
    id: r['id'] ?? r[`${kind}_id`],
    name: r['name'] ?? r[`${kind}_name`],
    admissions: r['admissions'] ?? 0,
    avg_los_days: r['avg_los_days'] ?? r['avg_length_of_stay'] ?? 0,
    total_claims: r['total_claims'] ?? r['claims'] ?? 0,
    denied_claims: r['denied_claims'] ?? 0,
    denial_rate: r['denial_rate'] ?? 0,
    submitted_amount: r['submitted_amount'] ?? r['claim_amount'] ?? 0,
    paid_amount: r['paid_amount'] ?? null,
    pending_amount: r['pending_amount'] ?? 0,
    denied_amount: r['denied_amount'] ?? 0,
  }));
  return { period: period(raw), rows };
}

// ------------------------------------------------------------------- claims
const band = (days: number | null) => (days === null ? null : days <= 30 ? '0–30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : 'Over 90 days');

export function normalizeClaims(raw: Raw): ClaimsResponse {
  if (!raw || raw['charts']) return raw as ClaimsResponse;
  const t = raw['totals'] ?? {};
  const status = arr(raw['by_status']);
  const payers = arr(raw['by_payer']);
  const aging = arr(raw['pending_aging']?.['buckets']);
  const list = raw['pending_over_30d'] ?? {};
  const label = (s: string) => (s === 'Paid' ? 'Approved' : s);

  // Sankey: top 4 payers by volume, the rest grouped
  const sorted = [...payers].sort((a, b) => (b['claims'] ?? 0) - (a['claims'] ?? 0));
  const named = sorted.length > 5 ? sorted.slice(0, 4) : sorted;
  const rest = sorted.length > 5 ? sorted.slice(4) : [];
  const sum = (rows: Raw[], k: string) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const groups = named.map(p => ({ n: p['payer_name'], paid: p['paid_claims'] ?? 0, denied: p['denied_claims'] ?? 0, pending: p['pending_claims'] ?? 0 }));
  if (rest.length) groups.push({ n: 'Other payers', paid: sum(rest, 'paid_claims'), denied: sum(rest, 'denied_claims'), pending: sum(rest, 'pending_claims') });

  const items: ClaimRow[] = arr(list['rows']).map(r => ({
    claim_id: r['claim_id'], hospital_name: r['hospital_name'], department_name: r['department_name'], payer_name: r['payer_name'],
    claim_amount: r['claim_amount'], status: 'Pending', days_pending: r['days_pending'] ?? null, aging_band: r['aging_band'] ?? band(r['days_pending'] ?? null),
  }));
  return {
    period: period(raw), last_refreshed: raw['generated_at'],
    totals: {
      total_claims: t['claims'] ?? t['total_claims'] ?? 0,
      approved_claims: t['paid_claims'] ?? t['approved_claims'] ?? 0,
      denied_claims: t['denied_claims'] ?? 0,
      pending_claims: t['pending_claims'] ?? 0,
      pending_over_30_days: t['pending_over_30d'] ?? t['pending_over_30_days'] ?? 0,
    },
    charts: {
      status_distribution: { chartType: 'pie', title: 'Claim status distribution', xKey: 'status', series: [{ dataKey: 'claims', label: 'Claims' }], data: status.map(s => ({ status: label(s['claim_status']), claims: s['claims'] })), options: { donut: true } },
      outcomes_by_payer: { chartType: 'sankey', title: 'Claim outcomes by payer', series: [{ dataKey: 'value', label: 'Claims' }], data: groups.flatMap(g => [{ source: g.n, target: 'Approved', value: g.paid }, { source: g.n, target: 'Denied', value: g.denied }, { source: g.n, target: 'Pending', value: g.pending }]) },
      pending_aging: { chartType: 'bar', title: 'Pending claims by age', xKey: 'band', series: [{ dataKey: 'claims', label: 'Pending' }], data: aging.map(b => ({ band: String(b['bucket']).replace(/^over/, 'Over'), claims: b['claims'] })) },
    },
    pending_by_payer: Object.fromEntries(payers.filter(p => typeof p['pending_claims'] === 'number').map(p => [p['payer_id'], p['pending_claims']])),
    items,
    // the API pages the >30-day list; its size is the pending_over_30d total
    total: list['total'] ?? t['pending_over_30d'] ?? items.length,
    limit: list['limit'] ?? items.length,
    offset: list['offset'] ?? 0,
  };
}

// ------------------------------------------------------------------ denials
export function normalizeDenials(raw: Raw): DenialsResponse {
  if (!raw || raw['charts']) return raw as DenialsResponse;
  const t = raw['totals'] ?? {};
  const target = raw['target_pct'] ?? raw['target_rate'] ?? null;
  const multiple = raw['flag_multiple'] ?? 2;
  const payers = arr(raw['by_payer']);
  const reasons = arr(raw['by_reason']);
  const depts = arr(raw['by_department']);
  return {
    period: period(raw), last_refreshed: raw['generated_at'],
    totals: { denied_claims: t['denied_claims'] ?? 0, eligible_claims: t['claims'] ?? t['eligible_claims'] ?? 0, denial_rate: t['denial_rate'] ?? 0, target_rate: target },
    definition: raw['definition'] ?? null,
    by_payer: payers.map(p => ({
      payer_id: p['payer_id'], payer_name: p['payer_name'], total_claims: p['claims'] ?? 0, denied_claims: p['denied_claims'] ?? 0,
      pending_claims: p['pending_claims'] ?? null, denial_rate: p['denial_rate'] ?? 0,
    })),
    reasons: reasons.map(r => ({ code: r['code'] ?? r['denial_reason'], description: r['description'] ?? '', count: r['denied_claims'] ?? r['count'] ?? 0, share: r['share_pct'] ?? r['share'] ?? 0, amount: r['denied_amount'] ?? null })),
    charts: {
      by_payer: {
        chartType: 'bar', title: 'Denial rate by payer', xKey: 'payer', series: [{ dataKey: 'denial_rate', label: 'Denial rate' }],
        data: payers.map(p => ({ payer: p['payer_name'], denial_rate: p['suppressed'] ? null : p['denial_rate'] })),
        options: { orientation: 'horizontal', unit: '%', target: target ?? undefined, highlightAbove: target !== null ? target * multiple : undefined },
      },
      by_reason: {
        chartType: 'bar', title: 'Denials by reason', xKey: 'reason', series: [{ dataKey: 'denied_claims', label: 'Denials' }],
        data: reasons.map(r => ({ reason: r['denial_reason'] ?? r['code'], denied_claims: r['suppressed'] ? null : r['denied_claims'] ?? r['count'] })), options: { orientation: 'horizontal' },
      },
      by_department: {
        chartType: 'bar', title: 'Denial rate by department', xKey: 'department', series: [{ dataKey: 'denial_rate', label: 'Denial rate' }],
        data: [...depts].sort((a, b) => (b['denial_rate'] ?? 0) - (a['denial_rate'] ?? 0)).map(d => ({ department: d['department_name'], denial_rate: d['suppressed'] ? null : d['denial_rate'] })),
        options: { orientation: 'horizontal', unit: '%', target: target ?? undefined },
      },
      ...(arr(raw['trend']).length ? {
        monthly_rate: {
          chartType: 'line', title: 'Denial rate over time', xKey: 'period', series: [{ dataKey: 'denial_rate', label: 'Denial rate' }],
          data: arr(raw['trend']).map(r => ({ period: periodLabel(r['period'], raw['granularity'], spansYears(arr(raw['trend']))), denial_rate: r['denial_rate'] })),
          options: { unit: '%', target: target ?? undefined, markPeak: true },
        } as VisualizationSpec,
      } : {}),
    },
  };
}

// ------------------------------------------------------------------- trends
const TREND_UNIT: Record<string, string> = { percent: '%', days: ' d', currency: ' Cr', currency_inr: ' Cr' };

export function normalizeTrends(raw: Raw): TrendsResponse {
  if (!raw || raw['chart']) return raw as TrendsResponse;
  const g: Granularity = raw['granularity'] ?? 'month';
  const series = arr(raw['series']);
  const allPoints = series.flatMap(s => arr(s['points']));
  const multi = spansYears(allPoints);
  const isMoney = /currency|inr/i.test(String(raw['unit']));
  const val = (v: unknown) => (isMoney ? cr(v) : (v as number | null));
  const grouped = series.length > 1 || !!raw['group_by'];
  const label = raw['label'] ?? raw['metric'];
  const chart: VisualizationSpec = {
    chartType: 'line',
    title: grouped ? `${label} by ${raw['group_by'] ?? 'group'}` : String(label),
    xKey: 'period',
    seriesKey: grouped ? 'group' : undefined,
    series: [{ dataKey: 'value', label: String(label) }],
    data: series.flatMap(s => arr(s['points']).map(p => ({ period: periodLabel(p['period'], g, multi), group: s['name'], value: val(p['value']) }))),
    options: { unit: TREND_UNIT[String(raw['unit'])] ?? undefined, area: !grouped, markPeak: !grouped },
  };
  return { metric: raw['metric'], granularity: g, group_by: raw['group_by'] ?? null, chart };
}
