// Rule-based stand-in for /api/analytics/*. It mimics the real pipeline's shape
// (plan -> data -> facts -> insight) so the UI can be built before the agents exist.
import {
  AskRequest, AskResponse, HistoryDetail, HistoryItem, HistoryListResponse, HistoryQuery, HistoryStatus, VisualizationSpec,
} from '../models/api.models';
import {
  ADMISSIONS_TOTAL, CLAIM_AMOUNT_CR, DENIAL_TARGET, DEPARTMENTS, DEPT_ADMISSIONS, HOSPITALS, LOS_BY_DEPT, LOS_MONTHLY,
  MONTH_LONG, MONTH_SHORT, PAYERS, fmtInt, pendingByPayer, pendingByPayerAndHospital, periodLabel, round1, scopeLabel, seeded, sum,
} from './mock-data';

type Metric = 'admissions' | 'avg_los' | 'denial_rate' | 'claim_amount' | 'pending_over_30';

interface Plan {
  metric: Metric;
  dims: ('month' | 'department' | 'hospital' | 'payer' | 'year')[];
  department?: string;
  months: number[];
  hospitalIds: string[];
}

const METRIC_LABEL: Record<Metric, string> = {
  admissions: 'Admissions',
  avg_los: 'Avg length of stay',
  denial_rate: 'Denial rate',
  claim_amount: 'Claim amount',
  pending_over_30: 'Claims pending > 30 days',
};

const DEPT_ALIASES: [RegExp, string][] = [
  [/cardio/, 'Cardiology'], [/ortho/, 'Orthopedics'], [/general medicine|gen\.? med/, 'General Medicine'],
  [/neuro/, 'Neurology'], [/onco|cancer/, 'Oncology'], [/pa?ediatric|children/, 'Pediatrics'],
];

class MockError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export { MockError };

const newId = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

// ---------------------------------------------------------------------------
// 1. Interpret (stands in for analytics-planner + followup-resolver agents)
// ---------------------------------------------------------------------------
type Interpretation =
  | { kind: 'plan'; plan: Plan }
  | { kind: 'reject'; status: AskResponse['status']; message: string };

function interpret(question: string, prev: Plan | undefined, hospitalIds: string[]): Interpretation {
  const q = question.toLowerCase();

  const hosp = q.match(/hospital\s*(\d+)/);
  if (hosp && !HOSPITALS.some(h => h.id === `H${hosp[1].padStart(2, '0')}`)) {
    return { kind: 'reject', status: 'forbidden', message: `Hospital ${hosp[1].padStart(2, '0')} is outside your access. You can ask about Hospitals 01–03.` };
  }
  if (/ignore (your|all|previous)|list (all )?patients|patient names?|diagnos|treatment|prescri/.test(q)) {
    return { kind: 'reject', status: 'unsupported', message: 'I can answer operational questions about admissions, claims, denials and length of stay, not individual patients or clinical advice.' };
  }

  let metric: Metric | undefined =
    /denial|denied|reject/.test(q) ? 'denial_rate'
    : /length of stay|\blos\b|stay/.test(q) ? 'avg_los'
    : /pending|outstanding|stuck/.test(q) ? 'pending_over_30'
    : /claim amount|revenue|billed|amount/.test(q) ? 'claim_amount'
    : /admission|admitted/.test(q) ? 'admissions'
    : undefined;

  const isFollowup = !metric && !!prev;
  if (!metric && !prev) {
    return { kind: 'reject', status: 'clarify', message: 'Which measure do you want: admissions, claim amount, denial rate, length of stay or pending claims? And for which period?' };
  }
  metric = metric ?? prev!.metric;

  let months = prev?.months ?? [4, 5, 6, 7, 8, 9];
  if (/this year|ytd|year to date|each month this year/.test(q)) months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (/six months|6 months|half/.test(q)) months = [4, 5, 6, 7, 8, 9];
  else if (/three months|3 months|quarter/.test(q)) months = [7, 8, 9];
  else if (/last week|yesterday|today|this week|november/.test(q)) months = [];

  let department = isFollowup ? prev?.department : undefined;
  for (const [re, name] of DEPT_ALIASES) if (re.test(q)) department = name;

  let dims: Plan['dims'] = isFollowup ? [...(prev?.dims ?? [])] : [];
  if (/by department|per department|departments|department-wise/.test(q)) dims = [...new Set([...dims, 'department' as const])];
  if (/by hospital|split by hospital|per hospital|across hospitals/.test(q)) dims = [...new Set([...dims.filter(d => d !== 'department'), 'hospital' as const])];
  if (/monthly|each month|by month|trend|over time/.test(q)) dims = [...new Set(['month' as const, ...dims])];
  if (/last year|compare|previous year/.test(q)) dims = [...new Set(['month' as const, 'year' as const])];
  if (department) dims = dims.filter(d => d !== 'department');

  // sensible defaults per metric
  if (!dims.length) {
    dims = metric === 'admissions' || metric === 'claim_amount' ? ['month']
      : metric === 'avg_los' ? ['department'] : ['payer'];
  }
  if (metric === 'denial_rate') dims = ['payer'];
  if (metric === 'pending_over_30') dims = dims.includes('hospital') ? ['payer', 'hospital'] : ['payer'];

  return { kind: 'plan', plan: { metric, dims, department, months, hospitalIds } };
}

// ---------------------------------------------------------------------------
// 2. Execute (stands in for compiler + DB) and 3. facts + insight
// ---------------------------------------------------------------------------
function execute(plan: Plan): { chart: VisualizationSpec; facts: Record<string, string | number>; insight: string } | null {
  const { metric, dims, department, months } = plan;
  if (!months.length) return null;
  const k = plan.hospitalIds.length ? sum(HOSPITALS.filter(h => plan.hospitalIds.includes(h.id)).map(h => h.share)) : 1;
  const pl = periodLabel(months);
  const label = METRIC_LABEL[metric];
  const first = MONTH_LONG[months[0]], last = MONTH_LONG[months[months.length - 1]];

  const trendInsight = (vals: number[], subject: string, unit = '') => {
    const a = vals[0], b = vals[vals.length - 1];
    const pct = round1(((b - a) / a) * 100);
    const peakI = vals.indexOf(Math.max(...vals));
    const verb = b >= a ? 'rose' : 'fell';
    const fmt = (n: number) => (unit === ' Cr' ? `₹${round1(n)} Cr` : fmtInt(n));
    return {
      facts: {
        Total: unit === ' Cr' ? `₹${round1(sum(vals))} Cr` : fmtInt(sum(vals)),
        [`${MONTH_SHORT[months[0]]} → ${MONTH_SHORT[months[months.length - 1]]}`]: `${pct >= 0 ? '+' : ''}${pct}%`,
        Peak: `${MONTH_SHORT[months[peakI]]} · ${fmt(vals[peakI])}`,
      },
      insight: `${subject} ${verb} from ${fmt(a)} in ${first} to ${fmt(b)} in ${last} 2026 (${pct >= 0 ? '+' : ''}${pct}%), peaking at ${fmt(vals[peakI])} in ${MONTH_LONG[months[peakI]]}.`,
    };
  };

  if (metric === 'admissions' && dims.includes('month')) {
    if (dims.includes('year')) {
      const cur = months.map(i => Math.round(ADMISSIONS_TOTAL[i] * k));
      const prev = cur.map((v, j) => Math.round(v / (1.04 + (j % 3) * 0.012)));
      const data = months.flatMap((i, j) => [
        { month: MONTH_SHORT[i], year: '2025', admissions: prev[j] },
        { month: MONTH_SHORT[i], year: '2026', admissions: cur[j] },
      ]);
      const pct = round1(((sum(cur) - sum(prev)) / sum(prev)) * 100);
      return {
        chart: { chartType: 'line', title: `Admissions ${pl} vs same months 2025`, xKey: 'month', seriesKey: 'year', series: [{ dataKey: 'admissions', label: 'Admissions' }], data },
        facts: { '2026': fmtInt(sum(cur)), '2025': fmtInt(sum(prev)), Change: `+${pct}%` },
        insight: `Admissions for ${pl} were ${fmtInt(sum(cur))}, ${pct}% higher than the same months of 2025 (${fmtInt(sum(prev))}).`,
      };
    }
    if (department) {
      const vals = months.map(i => Math.round(DEPT_ADMISSIONS[department][i] * k));
      const t = trendInsight(vals, `${department} admissions`);
      return {
        chart: { chartType: 'line', title: `${department} admissions by month`, xKey: 'month', series: [{ dataKey: 'admissions', label: 'Admissions' }],
          data: months.map((i, j) => ({ month: MONTH_SHORT[i], department, admissions: vals[j] })), options: { area: true, markPeak: true } },
        ...t,
      };
    }
    if (dims.includes('department')) {
      const data = months.flatMap(i => DEPARTMENTS.map(d => ({ month: MONTH_SHORT[i], department: d, admissions: Math.round(DEPT_ADMISSIONS[d][i] * k) })));
      const totals = months.map(i => Math.round(ADMISSIONS_TOTAL[i] * k));
      const growth = DEPARTMENTS.map(d => ({ d, g: DEPT_ADMISSIONS[d][months[months.length - 1]] - DEPT_ADMISSIONS[d][months[0]] })).sort((a, b) => b.g - a.g)[0];
      const t = trendInsight(totals, `Admissions across ${scopeLabel(plan.hospitalIds).replace('All in scope', 'your').replace(/\((\d)\)/, '$1 hospitals')}`);
      return {
        chart: { chartType: 'line', title: 'Monthly admissions by department', xKey: 'month', seriesKey: 'department', series: [{ dataKey: 'admissions', label: 'Admissions' }], data },
        facts: t.facts,
        insight: `${t.insight} ${growth.d} had the largest increase.`,
      };
    }
    if (dims.includes('hospital')) {
      const data = months.flatMap(i => HOSPITALS.map(h => ({ month: MONTH_SHORT[i], hospital: h.name, admissions: Math.round(ADMISSIONS_TOTAL[i] * h.share) })));
      const t = trendInsight(months.map(i => ADMISSIONS_TOTAL[i]), 'Total admissions');
      return {
        chart: { chartType: 'line', title: 'Monthly admissions by hospital', xKey: 'month', seriesKey: 'hospital', series: [{ dataKey: 'admissions', label: 'Admissions' }], data },
        facts: t.facts, insight: `${t.insight} ${HOSPITALS[0].name} contributes the most admissions.`,
      };
    }
    const vals = months.map(i => Math.round(ADMISSIONS_TOTAL[i] * k));
    const t = trendInsight(vals, 'Admissions');
    return {
      chart: { chartType: 'line', title: 'Admissions by month', xKey: 'month', series: [{ dataKey: 'admissions', label: 'Admissions' }],
        data: months.map((i, j) => ({ month: MONTH_SHORT[i], admissions: vals[j] })), options: { area: true, markPeak: true } },
      ...t,
    };
  }

  if (metric === 'admissions') { // ranking by department / hospital
    const byHospital = dims.includes('hospital');
    const rows = byHospital
      ? HOSPITALS.map(h => ({ hospital: h.name, admissions: Math.round(sum(months.map(i => ADMISSIONS_TOTAL[i])) * h.share) }))
      : DEPARTMENTS.map(d => ({ department: d, admissions: Math.round(sum(months.map(i => DEPT_ADMISSIONS[d][i])) * k) }));
    rows.sort((a, b) => b.admissions - a.admissions);
    const key = byHospital ? 'hospital' : 'department';
    const top = rows[0] as Record<string, string | number>, bottom = rows[rows.length - 1] as Record<string, string | number>;
    return {
      chart: { chartType: 'bar', title: `Admissions by ${key}, ${pl}`, xKey: key, series: [{ dataKey: 'admissions', label: 'Admissions' }], data: rows, options: { orientation: 'horizontal' } },
      facts: { Highest: `${top[key]} · ${fmtInt(top['admissions'] as number)}`, Lowest: `${bottom[key]} · ${fmtInt(bottom['admissions'] as number)}`, Total: fmtInt(sum(rows.map(r => r.admissions))) },
      insight: `${top[key]} had the most admissions in ${pl} (${fmtInt(top['admissions'] as number)}); ${bottom[key]} had the fewest (${fmtInt(bottom['admissions'] as number)}).`,
    };
  }

  if (metric === 'claim_amount') {
    if (dims.includes('hospital')) {
      const data = months.flatMap(i => HOSPITALS.map(h => ({ month: MONTH_SHORT[i], hospital: h.name, amountCr: round1(CLAIM_AMOUNT_CR[i] * h.share) })));
      const t = trendInsight(months.map(i => CLAIM_AMOUNT_CR[i]), 'Total claim amount', ' Cr');
      return { chart: { chartType: 'line', title: 'Monthly claim amount by hospital (₹ Cr)', xKey: 'month', seriesKey: 'hospital', series: [{ dataKey: 'amountCr', label: '₹ Cr' }], data, options: { unit: ' Cr' } }, ...t };
    }
    const vals = months.map(i => round1(CLAIM_AMOUNT_CR[i] * k));
    const t = trendInsight(vals, 'Claim amount', ' Cr');
    return { chart: { chartType: 'line', title: 'Monthly claim amount (₹ Cr)', xKey: 'month', series: [{ dataKey: 'amountCr', label: '₹ Cr' }],
      data: months.map((i, j) => ({ month: MONTH_SHORT[i], amountCr: vals[j] })), options: { area: true, unit: ' Cr', markPeak: true } }, ...t };
  }

  if (metric === 'avg_los') {
    if (department) {
      const base = LOS_BY_DEPT.find(d => d.department === department)!.median;
      const vals = months.map(i => round1(base * (LOS_MONTHLY[i] / 4.55)));
      return {
        chart: { chartType: 'line', title: `${department} average length of stay (days)`, xKey: 'month', series: [{ dataKey: 'avgLos', label: 'Avg LOS (days)' }],
          data: months.map((i, j) => ({ month: MONTH_SHORT[i], avgLos: vals[j] })), options: { unit: ' d' } },
        facts: { Average: `${round1(sum(vals) / vals.length)} d`, Highest: `${MONTH_SHORT[months[vals.indexOf(Math.max(...vals))]]} · ${Math.max(...vals)} d` },
        insight: `${department} average length of stay was ${round1(sum(vals) / vals.length)} days across ${pl}, highest in ${MONTH_LONG[months[vals.indexOf(Math.max(...vals))]]} at ${Math.max(...vals)} days.`,
      };
    }
    const rows = LOS_BY_DEPT.map(d => ({ department: d.department, avgLos: round1(d.median * 1.08) })).sort((a, b) => b.avgLos - a.avgLos);
    return {
      chart: { chartType: 'bar', title: `Average length of stay by department, ${pl}`, xKey: 'department', series: [{ dataKey: 'avgLos', label: 'Avg LOS (days)' }], data: rows, options: { orientation: 'horizontal', unit: ' d' } },
      facts: { Longest: `${rows[0].department} · ${rows[0].avgLos} d`, Shortest: `${rows[rows.length - 1].department} · ${rows[rows.length - 1].avgLos} d` },
      insight: `${rows[0].department} has the longest average stay (${rows[0].avgLos} days); ${rows[rows.length - 1].department} the shortest (${rows[rows.length - 1].avgLos} days).`,
    };
  }

  if (metric === 'denial_rate') {
    const rows = [...PAYERS].sort((a, b) => b.denial - a.denial).map(p => ({ payer: p.name, denialRate: p.denial }));
    const above = rows.filter(r => r.denialRate > DENIAL_TARGET).length;
    return {
      chart: { chartType: 'bar', title: `Denial rate by payer, ${pl}`, xKey: 'payer', series: [{ dataKey: 'denialRate', label: 'Denial rate' }], data: rows,
        options: { orientation: 'horizontal', unit: '%', target: DENIAL_TARGET, highlightAbove: DENIAL_TARGET * 2 } },
      facts: { Highest: `${rows[0].payer} · ${rows[0].denialRate}%`, 'Above target': `${above} of ${rows.length}`, Target: `${DENIAL_TARGET}%` },
      insight: `${above} of ${rows.length} payers are above the ${DENIAL_TARGET}% denial target. ${rows[0].payer} is highest at ${rows[0].denialRate}%, more than twice the target.`,
    };
  }

  // pending_over_30
  const rows = pendingByPayer();
  if (dims.includes('hospital')) {
    const data = pendingByPayerAndHospital();
    return {
      chart: { chartType: 'bar', title: 'Claims pending more than 30 days, by payer and hospital', xKey: 'payer', seriesKey: 'hospital', series: [{ dataKey: 'claims', label: 'Claims' }], data },
      facts: { Total: fmtInt(sum(rows.map(r => r.claims))), Most: `${rows[0].payer} · ${rows[0].claims}` },
      insight: `${rows[0].payer} has the most claims pending over 30 days in every hospital; ${fmtInt(sum(rows.map(r => r.claims)))} are pending in total.`,
    };
  }
  return {
    chart: { chartType: 'bar', title: 'Claims pending more than 30 days, by payer', xKey: 'payer', series: [{ dataKey: 'claims', label: 'Claims' }], data: rows, options: { orientation: 'horizontal', highlightAbove: rows[1]?.claims ?? 0 } },
    facts: { Total: fmtInt(sum(rows.map(r => r.claims))), Most: `${rows[0].payer} · ${rows[0].claims}` },
    insight: `${fmtInt(sum(rows.map(r => r.claims)))} claims have been pending for more than 30 days; ${rows[0].payer} accounts for the most (${rows[0].claims}). Open Claims & payers for the full list.`,
  };
}

function appliedFilters(plan: Plan): Record<string, string> {
  const f: Record<string, string> = { Metric: METRIC_LABEL[plan.metric] };
  if (plan.department) f['Department'] = plan.department;
  const grouped = plan.dims.filter(d => d !== 'year').map(d => d[0].toUpperCase() + d.slice(1));
  if (plan.dims.includes('year')) grouped.push('Year');
  if (grouped.length) f['Grouped by'] = grouped.join(' × ');
  f['Hospitals'] = scopeLabel(plan.hospitalIds);
  if (plan.months.length) f['Period'] = periodLabel(plan.months);
  return f;
}

// ---------------------------------------------------------------------------
// Conversation + history store (in memory, per browser session)
// ---------------------------------------------------------------------------
interface Stored { item: HistoryItem; plan?: Plan; result: AskResponse }
const conversations = new Map<string, { plan?: Plan; lastId: string }>();
const history: Stored[] = [];

function toStatus(s: AskResponse['status']): HistoryStatus {
  return s === 'success' ? 'answered' : s === 'no_data' ? 'no_data' : s === 'forbidden' ? 'blocked' : 'clarified';
}

function run(req: AskRequest, isFollowup: boolean, askedAt = new Date()): AskResponse {
  const question = (req.question ?? '').trim().slice(0, 500);
  if (!question) throw new MockError(422, 'Please enter a question.');
  const conv = req.conversationId ? conversations.get(req.conversationId) : undefined;
  if (isFollowup && !conv) throw new MockError(404, 'That conversation has expired. Start a new question.');
  const conversationId = conv ? req.conversationId! : newId('CONV');
  const hospitalIds = req.filters?.hospitalIds ?? [];
  const rnd = seeded(question.length * 31 + askedAt.getMinutes());
  const executionTimeMs = Math.round(280 + rnd() * 320);
  const referenceId = newId('QRY');

  const interp = interpret(question, conv?.plan, hospitalIds);
  let result: AskResponse;
  let plan: Plan | undefined;

  if (interp.kind === 'reject') {
    result = { status: interp.status, message: interp.message, conversationId, referenceId, executionTimeMs };
  } else {
    plan = interp.plan;
    const out = execute(plan);
    result = out
      ? { status: 'success', metric: plan.metric, metricLabel: METRIC_LABEL[plan.metric], reportingPeriod: { from: `${'2026-' + String(plan.months[0] + 1).padStart(2, '0')}-01`, to: `2026-${String(plan.months[plan.months.length - 1] + 1).padStart(2, '0')}-28` },
          appliedFilters: appliedFilters(plan), chart: out.chart, facts: out.facts, insight: out.insight, conversationId, referenceId, executionTimeMs }
      : { status: 'no_data', message: 'No records matched these filters. The data currently runs to 31 October 2026.', metric: plan.metric, metricLabel: METRIC_LABEL[plan.metric],
          appliedFilters: appliedFilters(plan), conversationId, referenceId, executionTimeMs };
  }

  const item: HistoryItem = {
    id: referenceId,
    askedAt: askedAt.toISOString(),
    question,
    metricLabel: plan ? METRIC_LABEL[plan.metric] : null,
    scopeLabel: plan ? Object.entries(appliedFilters(plan)).filter(([k]) => k !== 'Metric' && k !== 'Hospitals').map(([, v]) => v).join(' · ') : (result.message ?? '').split(/[.?]/)[0],
    status: toStatus(result.status),
    rowCount: result.chart ? result.chart.data.length : result.status === 'no_data' ? 0 : null,
    durationMs: executionTimeMs,
    conversationId,
    parentId: conv?.lastId ?? null,
  };
  history.push({ item, plan, result });
  conversations.set(conversationId, { plan: plan ?? conv?.plan, lastId: referenceId });
  return result;
}

export const mockAsk = (req: AskRequest) => run(req, false);
export const mockFollowup = (req: AskRequest) => run(req, true);

export function mockHistory(q: HistoryQuery): HistoryListResponse {
  const all = [...history].sort((a, b) => b.item.askedAt.localeCompare(a.item.askedAt)).map(s => s.item);
  const term = (q.q ?? '').toLowerCase();
  const rows = all.filter(i => (!term || i.question.toLowerCase().includes(term)) && (!q.status || i.status === q.status));
  const page = q.page ?? 1, size = q.size ?? 10;
  return {
    summary: {
      asked: all.length,
      answered: all.filter(i => i.status === 'answered').length,
      clarifiedOrNoData: all.filter(i => i.status === 'clarified' || i.status === 'no_data').length,
      blocked: all.filter(i => i.status === 'blocked').length,
    },
    items: rows.slice((page - 1) * size, page * size), total: rows.length, page, size,
  };
}

export function mockHistoryDetail(id: string): HistoryDetail {
  const s = history.find(h => h.item.id === id);
  if (!s) throw new MockError(404, 'Query not found.');
  const parent = s.item.parentId ? history.find(h => h.item.id === s.item.parentId) : undefined;
  const plan = Object.entries(s.result.appliedFilters ?? {}).map(([label, value]) => ({ label, value }));
  plan.push({ label: 'Reference', value: s.item.id });
  return { item: s.item, parentQuestion: parent?.item.question ?? null, plan, result: s.result };
}

export function mockRerun(id: string): AskResponse {
  const s = history.find(h => h.item.id === id);
  if (!s) throw new MockError(404, 'Query not found.');
  if (!s.plan) throw new MockError(409, 'This question was not answered, so there is nothing to re-run.');
  const out = execute(s.plan);
  const referenceId = newId('QRY');
  return out
    ? { ...s.result, chart: out.chart, facts: out.facts, insight: out.insight, referenceId, executionTimeMs: 300 + Math.round(Math.random() * 200) }
    : { ...s.result, status: 'no_data', referenceId };
}

// ---------------------------------------------------------------------------
// Seed history by replaying conversations through the same engine
// ---------------------------------------------------------------------------
(function seed() {
  const now = Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000);
  const convs: { q: string; minsAgo: number }[][] = [
    [{ q: 'Claims pending more than 30 days', minsAgo: 3 * 1440 + 120 }, { q: 'Split by hospital', minsAgo: 3 * 1440 + 118 }],
    [{ q: 'Pediatrics admissions in Hospital 03 last week', minsAgo: 1440 + 380 }],
    [{ q: 'How are we doing?', minsAgo: 1440 + 90 }],
    [{ q: 'Average length of stay by department', minsAgo: 1440 + 70 }],
    [{ q: 'Show claims for Hospital 07', minsAgo: 420 }],
    [{ q: 'Which payers have the highest denial rate?', minsAgo: 240 }],
    [{ q: 'How many admissions occurred each month this year?', minsAgo: 150 }],
    [{ q: 'Show monthly admissions by department for the last six months', minsAgo: 4 }, { q: 'Now show only Cardiology', minsAgo: 2 }],
  ];
  for (const c of convs) {
    let convId: string | null = null;
    c.forEach((turn, i) => {
      const r = run({ question: turn.q, conversationId: convId }, i > 0, at(turn.minsAgo));
      convId = r.conversationId;
    });
  }
})();
