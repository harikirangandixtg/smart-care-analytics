// Static synthetic POC data, served by the mock interceptor in the shapes from api.models.ts.
// Same dataset as the canvas designs: 11,065 admissions, 13,280 claims, 1,345 denied, ₹48.6 Cr billed (Jan–Oct 2026).
import {
  AdmissionsResponse, ClaimRow, ClaimsResponse, DashboardFilters, DenialsResponse, DimensionResponse, DimensionRow,
  Granularity, GroupBy, Kpi, MetricDef, NamedEntity, RevenueResponse, SummaryResponse, TrendsResponse, VisualizationSpec,
} from '../models/api.models';

// ------------------------------------------------------------------ base data
export const MONTH_KEYS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31];

export const HOSPITALS = [
  { id: 'H001', name: 'Hospital 01', share: 0.42, los: 4.5 },
  { id: 'H002', name: 'Hospital 02', share: 0.33, los: 4.8 },
  { id: 'H003', name: 'Hospital 03', share: 0.25, los: 4.6 },
];

export const ADMISSIONS_TOTAL = [980, 1010, 1045, 1020, 1090, 1130, 1175, 1160, 1210, 1245];

export const DEPT_ADMISSIONS: Record<string, number[]> = {
  Cardiology: [176, 181, 194, 191, 204, 210, 266, 260, 276, 233],
  Orthopedics: [152, 157, 168, 164, 175, 182, 180, 178, 185, 200],
  'General Medicine': [146, 151, 162, 158, 169, 175, 173, 171, 178, 193],
  Neurology: [116, 120, 129, 125, 134, 139, 137, 136, 141, 153],
  Oncology: [108, 111, 119, 116, 124, 129, 127, 126, 131, 142],
  Pediatrics: [122, 125, 108, 105, 112, 116, 115, 114, 118, 128],
  Gastroenterology: [78, 81, 87, 85, 90, 94, 93, 92, 95, 103],
  Pulmonology: [82, 84, 78, 76, 82, 85, 84, 83, 86, 93],
};
export const DEPARTMENTS = Object.keys(DEPT_ADMISSIONS);
export const DEPT_IDS: Record<string, string> = Object.fromEntries(DEPARTMENTS.map((d, i) => [d, `D${String(i + 1).padStart(3, '0')}`]));
const DEPT_LOS: Record<string, number> = { Cardiology: 4.9, Orthopedics: 4.4, 'General Medicine': 3.6, Neurology: 6.9, Oncology: 5.8, Pediatrics: 2.8, Gastroenterology: 3.9, Pulmonology: 4.6 };
export const LOS_BY_DEPT = DEPARTMENTS.map(d => ({ department: d, median: DEPT_LOS[d] }));
export const LOS_MONTHLY = [4.3, 4.3, 4.4, 4.5, 4.5, 4.6, 4.7, 4.6, 4.7, 4.8];

// Claims per payer: total, paid (approved), denied, pending — sums 13,280 / 11,380 / 1,345 / 555.
export const PAYER_CLAIMS = [
  { id: 'P001', name: 'Payer A', total: 2100, denied: 450, pending: 160 },
  { id: 'P002', name: 'Payer B', total: 2600, denied: 255, pending: 105 },
  { id: 'P003', name: 'Payer C', total: 2400, denied: 206, pending: 89 },
  { id: 'P004', name: 'Payer D', total: 2200, denied: 174, pending: 71 },
  { id: 'P005', name: 'Payer E', total: 1150, denied: 80, pending: 36 },
  { id: 'P006', name: 'Payer F', total: 1050, denied: 70, pending: 34 },
  { id: 'P007', name: 'Payer G', total: 950, denied: 60, pending: 30 },
  { id: 'P008', name: 'Payer H', total: 830, denied: 50, pending: 30 },
].map(p => ({ ...p, paid: p.total - p.denied - p.pending, denial: Math.round((p.denied / p.total) * 1000) / 10 }));
export const PAYERS = PAYER_CLAIMS;
export const DENIAL_TARGET = 8;
export const DENIAL_RATE_MONTHLY = [8.4, 8.7, 9.1, 9.5, 9.8, 10.1, 10.8, 11.2, 11.6, 12.0];
export const CLAIMS_MONTHLY = [1210, 1240, 1290, 1270, 1320, 1350, 1380, 1370, 1410, 1440];

export const CARC = [
  { code: 'CO-197', description: 'Precertification / authorisation absent', count: 398 },
  { code: 'CO-50', description: 'Non-covered service (not medically necessary)', count: 302 },
  { code: 'CO-16', description: 'Claim lacks information needed for adjudication', count: 241 },
  { code: 'CO-4', description: 'Procedure code inconsistent with modifier', count: 168 },
  { code: 'CO-29', description: 'Time limit for filing has expired', count: 121 },
  { code: 'CO-97', description: 'Payment included in another service already adjudicated', count: 115 },
];
const DEPT_DENIAL: Record<string, number> = { Oncology: 13.6, Cardiology: 11.8, Neurology: 10.9, Orthopedics: 9.4, Gastroenterology: 9.0, Pulmonology: 8.8, 'General Medicine': 8.1, Pediatrics: 6.2 };

// Revenue (₹ crore per month): submitted, and the denied / pending share of each month.
export const CLAIM_AMOUNT_CR = [4.3, 4.4, 4.6, 4.5, 4.8, 4.9, 5.1, 5.0, 5.4, 5.6];
const DENIED_SHARE = [8.6, 8.8, 9.0, 9.2, 9.6, 9.8, 10.2, 10.4, 10.8, 11.0];
const PENDING_SHARE = [0.6, 0.6, 0.8, 0.8, 1.0, 1.4, 2.4, 5.0, 10.5, 21.0];
const DEPT_AMOUNT_SHARE: Record<string, number> = { Cardiology: 0.22, Oncology: 0.19, Orthopedics: 0.17, Neurology: 0.14, 'General Medicine': 0.11, Gastroenterology: 0.07, Pediatrics: 0.05, Pulmonology: 0.05 };
const CR = 1e7; // rupees per crore

// ------------------------------------------------------------------- helpers
export function seeded(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-IN');
export const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function monthRange(from: string | null, to: string | null): number[] {
  const f = (from ?? '2026-01-01').slice(0, 7), t = (to ?? '2026-10-31').slice(0, 7);
  const idx = MONTH_KEYS.map((m, i) => (m >= f && m <= t ? i : -1)).filter(i => i >= 0);
  return idx.length ? idx : MONTH_KEYS.map((_, i) => i);
}
export const periodLabel = (idx: number[]) => `${MONTH_SHORT[idx[0]]} – ${MONTH_SHORT[idx[idx.length - 1]]} 2026`;
export function scopeLabel(ids: string[]): string {
  if (!ids.length) return `All in scope (${HOSPITALS.length})`;
  return HOSPITALS.filter(h => ids.includes(h.id)).map(h => h.name).join(', ');
}

/** Scope of one request: months, hospital share, selected department / payer. */
function scope(f: DashboardFilters) {
  const months = monthRange(f.date_from, f.date_to);
  const hk = f.hospital_id.length ? sum(HOSPITALS.filter(h => f.hospital_id.includes(h.id)).map(h => h.share)) || 1 : 1;
  const dept = DEPARTMENTS.find(d => f.department_id.includes(DEPT_IDS[d])) ?? null;
  const payer = PAYER_CLAIMS.find(p => f.payer_id.includes(p.id)) ?? null;
  const monthShare = sum(months.map(i => CLAIMS_MONTHLY[i])) / sum(CLAIMS_MONTHLY);
  const deptShare = dept ? sum(DEPT_ADMISSIONS[dept]) / sum(ADMISSIONS_TOTAL) : 1;
  const payerShare = payer ? payer.total / sum(PAYER_CLAIMS.map(p => p.total)) : 1;
  return { months, hk, dept, payer, monthShare, deptShare, payerShare, period: { date_from: `${MONTH_KEYS[months[0]]}-01`, date_to: `${MONTH_KEYS[months[months.length - 1]]}-${DAYS_IN_MONTH[months[months.length - 1]]}` } };
}
const now = () => new Date().toISOString();
const admSeries = (dept: string | null) => (dept ? DEPT_ADMISSIONS[dept] : ADMISSIONS_TOTAL);

// ------------------------------------------------------------------ metadata
export const hospitals = (): NamedEntity[] => HOSPITALS.map(({ id, name }) => ({ id, name }));
export const departments = (): NamedEntity[] => DEPARTMENTS.map(d => ({ id: DEPT_IDS[d], name: d }));
export const payers = (): NamedEntity[] => PAYER_CLAIMS.map(({ id, name }) => ({ id, name }));
export const metrics = (): MetricDef[] => [
  { key: 'admissions', label: 'Admissions', unit: 'count' },
  { key: 'avg_los', label: 'Average length of stay', unit: 'days' },
  { key: 'claims', label: 'Claims', unit: 'count' },
  { key: 'denial_rate', label: 'Denial rate', unit: 'percent', description: 'Denied claims ÷ adjudicated + pending claims' },
  { key: 'submitted_amount', label: 'Submitted claim amount', unit: 'currency_inr', description: 'Billed to payers; not revenue' },
  { key: 'paid_amount', label: 'Paid amount', unit: 'currency_inr', description: 'Recognised revenue' },
  { key: 'pending_amount', label: 'Pending amount', unit: 'currency_inr' },
  { key: 'denied_amount', label: 'Denied amount', unit: 'currency_inr' },
];

// ------------------------------------------------------------------- summary
export function summary(f: DashboardFilters): SummaryResponse {
  const s = scope(f);
  const adm = s.months.map(i => admSeries(s.dept)[i] * s.hk);
  const claims = s.months.map(i => CLAIMS_MONTHLY[i] * s.hk * s.deptShare * s.payerShare);
  const amount = s.months.map(i => CLAIM_AMOUNT_CR[i] * s.hk * s.deptShare * s.payerShare);
  const denial = s.payer ? s.payer.denial : round1(sum(PAYER_CLAIMS.map(p => p.denied)) / sum(PAYER_CLAIMS.map(p => p.total)) * 100);
  const los = s.dept ? DEPT_LOS[s.dept] : round1(sum(s.months.map(i => LOS_MONTHLY[i])) / s.months.length);
  const kpis: Kpi[] = [
    { key: 'admissions', label: 'Admissions', value: Math.round(sum(adm)), unit: 'count', change: { label: '+6.2%', direction: 'up', favourable: true }, sparkline: adm.map(Math.round) },
    { key: 'patients', label: 'Unique patients', value: Math.round(sum(adm) * 0.67), unit: 'count', change: { label: '+4.8%', direction: 'up', favourable: true }, sparkline: adm.map(v => Math.round(v * 0.67)) },
    { key: 'submitted_amount', label: 'Claim amount (submitted)', value: Math.round(sum(amount) * CR), unit: 'currency_inr', note: 'Billed, not revenue', change: { label: '+7.9%', direction: 'up', favourable: true }, sparkline: amount.map(round2) },
    { key: 'claims', label: 'Claims', value: Math.round(sum(claims)), unit: 'count', change: { label: '+5.1%', direction: 'up', favourable: true }, sparkline: claims.map(Math.round) },
    { key: 'denial_rate', label: 'Denial rate', value: denial, unit: 'percent', change: { label: '+1.3 pts', direction: 'up', favourable: false }, sparkline: s.months.map(i => DENIAL_RATE_MONTHLY[i]) },
    { key: 'avg_los', label: 'Avg length of stay', value: los, unit: 'days', change: { label: '+0.3 d', direction: 'up', favourable: false }, sparkline: s.months.map(i => LOS_MONTHLY[i]) },
  ];
  return { period: s.period, comparison_label: 'vs same period 2025', last_refreshed: now(), kpis };
}

// ---------------------------------------------------------------- admissions
function bucketed(values: number[], months: number[], g: Granularity): { label: string; value: number }[] {
  if (g === 'quarter') {
    const q = new Map<string, number>();
    months.forEach((i, j) => { const k = `Q${Math.floor(i / 3) + 1}`; q.set(k, (q.get(k) ?? 0) + values[j]); });
    return [...q.entries()].map(([label, value]) => ({ label, value: Math.round(value) }));
  }
  if (g === 'week') {
    const rnd = seeded(42); const out: { label: string; value: number }[] = [];
    months.forEach((i, j) => { for (let w = 0; w < 4; w++) out.push({ label: `${MONTH_SHORT[i]} ${1 + w * 7}`, value: Math.round((values[j] / 4.33) * (0.93 + rnd() * 0.14)) }); });
    return out;
  }
  return months.map((i, j) => ({ label: MONTH_SHORT[i], value: Math.round(values[j]) }));
}

export function admissions(f: DashboardFilters, g: Granularity, top: number): AdmissionsResponse {
  const s = scope(f); const pl = periodLabel(s.months);
  const series = s.months.map(i => admSeries(s.dept)[i] * s.hk);
  const total = Math.round(sum(series));
  const days = sum(s.months.map(i => DAYS_IN_MONTH[i]));
  const deptRows = DEPARTMENTS.map(d => ({ department: d, admissions: Math.round(sum(s.months.map(i => DEPT_ADMISSIONS[d][i])) * s.hk) }))
    .filter(r => !s.dept || r.department === s.dept).sort((a, b) => b.admissions - a.admissions).slice(0, top);
  const hospRows = (f.hospital_id.length ? HOSPITALS.filter(h => f.hospital_id.includes(h.id)) : HOSPITALS)
    .map(h => ({ hospital: h.name, admissions: Math.round(sum(s.months.map(i => admSeries(s.dept)[i])) * h.share), avg_los: h.los }));
  const losRows = DEPARTMENTS.filter(d => !s.dept || d === s.dept).map(d => ({ department: d, avg_los: DEPT_LOS[d] })).sort((a, b) => b.avg_los - a.avg_los);
  const heat = DEPARTMENTS.slice(0, 6).filter(d => !s.dept || d === s.dept)
    .flatMap(d => s.months.map(i => ({ month: MONTH_SHORT[i], department: d, admissions: Math.round(DEPT_ADMISSIONS[d][i] * s.hk) })));
  const lastIdx = s.months[s.months.length - 1];
  const fac = [1.15, 1.08, 1.04, 1.02, 1.0, 0.88, 0.83]; // Mon..Sun
  const lastDays = DAYS_IN_MONTH[lastIdx];
  const raw = Array.from({ length: lastDays }, (_, d) => fac[(new Date(2026, lastIdx, d + 1).getDay() + 6) % 7] * (1 + 0.05 * Math.sin(d * 1.7)));
  const lastTotal = admSeries(s.dept)[lastIdx] * s.hk;
  const daily = raw.map(r => Math.round((lastTotal * r) / sum(raw)));
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({ weekday: d, admissions: Math.round((total * fac[i]) / sum(fac)) }));
  const peakJ = series.indexOf(Math.max(...series));
  const topD = deptRows[0];
  const trend = bucketed(series, s.months, g);

  const charts: Record<string, VisualizationSpec> = {
    trend: { chartType: 'line', title: `${g === 'week' ? 'Weekly' : g === 'quarter' ? 'Quarterly' : 'Monthly'} admissions, ${pl}`, xKey: 'period', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: trend.map(t => ({ period: t.label, admissions: t.value })), options: { area: true, markPeak: true } },
    by_department: { chartType: 'bar', title: `Admissions by department, ${pl}`, xKey: 'department', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: deptRows, options: { orientation: 'horizontal' } },
    by_hospital: { chartType: 'bar', title: `Admissions by hospital, ${pl}`, xKey: 'hospital', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: hospRows },
    los_by_department: { chartType: 'bar', title: 'Average length of stay by department', xKey: 'department', series: [{ dataKey: 'avg_los', label: 'Avg LOS (days)' }], data: losRows, options: { orientation: 'horizontal', unit: ' d', target: round1(sum(DEPARTMENTS.map(d => DEPT_LOS[d] * sum(DEPT_ADMISSIONS[d]))) / sum(ADMISSIONS_TOTAL)), highlightAbove: 6 } },
    department_heatmap: { chartType: 'heatmap', title: `Admissions, department × month, ${pl}`, xKey: 'month', seriesKey: 'department', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: heat },
    daily_trend: { chartType: 'line', title: `Daily admissions, ${MONTH_LONG[lastIdx]} 2026`, xKey: 'day', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: daily.map((v, d) => ({ day: String(d + 1), admissions: v })) },
    weekday_distribution: { chartType: 'bar', title: `Admissions by weekday, ${pl}`, xKey: 'weekday', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: weekday },
  };
  return {
    period: s.period, granularity: g, last_refreshed: now(), charts,
    totals: {
      total_admissions: total,
      admissions_per_day: round1(total / days),
      avg_los_days: s.dept ? DEPT_LOS[s.dept] : 4.6,
      top_department: topD ? { name: topD.department, admissions: topD.admissions, share: round1((topD.admissions / total) * 100) } : null,
      peak_period: { label: `${MONTH_SHORT[s.months[peakJ]]} 2026`, admissions: Math.round(series[peakJ]) },
    },
  };
}

// ------------------------------------------------------------------- revenue
function revenueMonths(f: DashboardFilters) {
  const s = scope(f); const k = s.hk * s.deptShare * s.payerShare;
  const sub = s.months.map(i => CLAIM_AMOUNT_CR[i] * k);
  const den = s.months.map((i, j) => (sub[j] * DENIED_SHARE[i]) / 100);
  const pen = s.months.map((i, j) => (sub[j] * PENDING_SHARE[i]) / 100);
  const paid = sub.map((v, j) => v - den[j] - pen[j]);
  return { s, k, sub, den, pen, paid };
}

export function revenue(f: DashboardFilters, top: number): RevenueResponse {
  const { s, sub, den, pen, paid } = revenueMonths(f);
  const tS = sum(sub), tD = sum(den), tP = sum(pen), tPaid = sum(paid);
  const pl = periodLabel(s.months);
  const payerRows = PAYER_CLAIMS.filter(p => !s.payer || p.id === s.payer.id).map(p => {
    const share = p.total / sum(PAYER_CLAIMS.map(x => x.total));
    const total = (s.payer ? tS : tS * share);
    const d = s.payer ? tD : (tD * p.denied) / sum(PAYER_CLAIMS.map(x => x.denied));
    const pe = s.payer ? tP : (tP * p.pending) / sum(PAYER_CLAIMS.map(x => x.pending));
    return { payer: p.name, paid: round2(total - d - pe), pending: round2(pe), denied: round2(d) };
  }).slice(0, top);
  return {
    period: s.period, last_refreshed: now(),
    totals: { submitted_amount: Math.round(tS * CR), paid_amount: Math.round(tPaid * CR), pending_amount: Math.round(tP * CR), denied_amount: Math.round(tD * CR), currency: 'INR' },
    charts: {
      monthly_by_status: { chartType: 'bar', title: `Claim amount by outcome, ${pl} (₹ Cr)`, xKey: 'month', series: [{ dataKey: 'paid', label: 'Paid' }, { dataKey: 'pending', label: 'Pending' }, { dataKey: 'denied', label: 'Denied' }], data: s.months.map((i, j) => ({ month: MONTH_SHORT[i], paid: round2(paid[j]), pending: round2(pen[j]), denied: round2(den[j]) })), options: { stacked: true, unit: ' Cr' } },
      by_payer_status: { chartType: 'bar', title: `Claim amount by payer and outcome (₹ Cr)`, xKey: 'payer', series: [{ dataKey: 'paid', label: 'Paid' }, { dataKey: 'pending', label: 'Pending' }, { dataKey: 'denied', label: 'Denied' }], data: payerRows, options: { stacked: true, orientation: 'horizontal', unit: ' Cr' } },
      pending_by_payer: { chartType: 'bar', title: 'Pending claim amount by payer (₹ Cr)', xKey: 'payer', series: [{ dataKey: 'pending', label: 'Pending' }], data: [...payerRows].sort((a, b) => b.pending - a.pending).map(r => ({ payer: r.payer, pending: r.pending })), options: { orientation: 'horizontal', unit: ' Cr' } },
      status_mix: { chartType: 'pie', title: 'Total claim amount by outcome (₹ Cr)', xKey: 'status', series: [{ dataKey: 'amount', label: '₹ Cr' }], data: [{ status: 'Paid', amount: round2(tPaid) }, { status: 'Pending', amount: round2(tP) }, { status: 'Denied', amount: round2(tD) }], options: { donut: true, unit: ' Cr' } },
    },
  };
}

// ----------------------------------------------------- hospitals / departments
export function dimension(kind: 'hospitals' | 'departments', f: DashboardFilters): DimensionResponse {
  const { s, sub, den, pen, paid } = revenueMonths(f);
  const tS = sum(sub), tD = sum(den), tP = sum(pen), tPaid = sum(paid);
  const totalClaims = sum(s.months.map(i => CLAIMS_MONTHLY[i])) * s.hk * s.deptShare * s.payerShare;
  const deniedRate = s.payer ? s.payer.denial / 100 : 1345 / 13280;
  let rows: DimensionRow[];
  if (kind === 'hospitals') {
    const ratio = [0.851, 0.836, 0.832];
    const hs = HOSPITALS.map((h, i) => ({ h, i })).filter(({ h }) => !f.hospital_id.length || f.hospital_id.includes(h.id));
    const shareSum = sum(hs.map(({ h }) => h.share));
    rows = hs.map(({ h, i }) => {
      const w = h.share / shareSum; const subm = tS * w; const paidH = (tPaid * w * ratio[i]) / 0.84;
      return { id: h.id, name: h.name, admissions: Math.round(sum(s.months.map(m => admSeries(s.dept)[m])) * h.share), avg_los_days: h.los,
        total_claims: Math.round(totalClaims * w), denied_claims: Math.round(totalClaims * w * deniedRate), denial_rate: round1(deniedRate * 100 * (0.94 + i * 0.05)),
        submitted_amount: Math.round(subm * CR), paid_amount: Math.round(Math.min(paidH, subm) * CR), pending_amount: Math.round(tP * w * CR), denied_amount: Math.round(tD * w * CR) };
    });
  } else {
    const ds = DEPARTMENTS.filter(d => !s.dept || d === s.dept);
    const ws = ds.map(d => DEPT_AMOUNT_SHARE[d]); const wsum = sum(ws);
    rows = ds.map((d, j) => {
      const w = ws[j] / wsum;
      return { id: DEPT_IDS[d], name: d, admissions: Math.round(sum(s.months.map(i => DEPT_ADMISSIONS[d][i])) * s.hk), avg_los_days: DEPT_LOS[d],
        total_claims: Math.round(totalClaims * w), denied_claims: Math.round(totalClaims * w * DEPT_DENIAL[d] / 100), denial_rate: DEPT_DENIAL[d],
        submitted_amount: Math.round(tS * w * CR), paid_amount: Math.round(tPaid * w * CR), pending_amount: Math.round(tP * w * CR), denied_amount: Math.round(tD * w * CR) };
    }).sort((a, b) => b.submitted_amount - a.submitted_amount);
  }
  return { period: s.period, rows };
}

// -------------------------------------------------------------------- claims
const CLAIM_ROWS: ClaimRow[] = (() => {
  const rnd = seeded(7); const rows: ClaimRow[] = [];
  const pick = <T>(xs: T[], w: number[]) => { let r = rnd() * sum(w); for (let i = 0; i < xs.length; i++) { r -= w[i]; if (r <= 0) return xs[i]; } return xs[xs.length - 1]; };
  // 555 pending claims: 312 within 30 days, 141 at 31–60, 68 at 61–90, 34 over 90
  const bands: [number, number, number][] = [[312, 1, 30], [141, 31, 60], [68, 61, 90], [34, 91, 140]];
  let n = 0;
  for (const [count, lo, hi] of bands) for (let c = 0; c < count; c++) {
    const p = pick(PAYER_CLAIMS, PAYER_CLAIMS.map(x => x.pending));
    const h = pick(HOSPITALS, HOSPITALS.map(x => x.share));
    const d = pick(DEPARTMENTS, DEPARTMENTS.map(x => DEPT_AMOUNT_SHARE[x]));
    const days = lo + Math.floor(rnd() * (hi - lo + 1));
    rows.push({ claim_id: `CLM-${String(206000 + n++ * 7 + Math.floor(rnd() * 7)).padStart(6, '0')}`, hospital_name: h.name, department_name: d, payer_name: p.name,
      claim_amount: Math.round((15000 + rnd() * rnd() * 420000) / 50) * 50, status: 'Pending', days_pending: days,
      aging_band: days <= 30 ? '0–30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : 'Over 90 days' });
  }
  return rows.sort((a, b) => (b.days_pending ?? 0) - (a.days_pending ?? 0));
})();

function sankey(rows: typeof PAYER_CLAIMS): VisualizationSpec {
  const named = rows.length > 5 ? rows.slice(0, 4) : rows;
  const rest = rows.length > 5 ? rows.slice(4) : [];
  const groups = [...named.map(r => ({ n: r.name, paid: r.paid, denied: r.denied, pending: r.pending }))];
  if (rest.length) groups.push({ n: 'Other payers', paid: sum(rest.map(r => r.paid)), denied: sum(rest.map(r => r.denied)), pending: sum(rest.map(r => r.pending)) });
  return { chartType: 'sankey', title: 'Claim outcomes by payer', series: [{ dataKey: 'value', label: 'Claims' }],
    data: groups.flatMap(g => [{ source: g.n, target: 'Approved', value: g.paid }, { source: g.n, target: 'Denied', value: g.denied }, { source: g.n, target: 'Pending', value: g.pending }]) };
}

export function claims(f: DashboardFilters, limit: number, offset: number): ClaimsResponse {
  const s = scope(f); const k = s.hk * s.monthShare * s.deptShare;
  const pr = PAYER_CLAIMS.filter(p => !s.payer || p.id === s.payer.id).map(p => ({ ...p, total: Math.round(p.total * k), paid: Math.round(p.paid * k), denied: Math.round(p.denied * k), pending: Math.round(p.pending * k) }));
  const total = sum(pr.map(p => p.total)), denied = sum(pr.map(p => p.denied)), pending = sum(pr.map(p => p.pending)), approved = total - denied - pending;
  const hosp = f.hospital_id.length ? HOSPITALS.filter(h => f.hospital_id.includes(h.id)).map(h => h.name) : null;
  const statusFilter = f.claim_status?.length ? f.claim_status : null;
  let rows = CLAIM_ROWS.filter(r => (r.days_pending ?? 0) > 30 && (!hosp || hosp.includes(r.hospital_name)) && (!s.dept || r.department_name === s.dept) && (!s.payer || r.payer_name === s.payer.name) && (!statusFilter || statusFilter.includes(r.status)));
  const bands = ['0–30 days', '31–60 days', '61–90 days', 'Over 90 days'];
  const aging = bands.map(b => ({ band: b, claims: Math.round(CLAIM_ROWS.filter(r => r.aging_band === b).length * (pending / 555 || 0)) }));
  const over30 = sum(aging.slice(1).map(a => a.claims));
  return {
    period: s.period, last_refreshed: now(),
    totals: { total_claims: total, approved_claims: approved, denied_claims: denied, pending_claims: pending, pending_over_30_days: over30 },
    charts: {
      status_distribution: { chartType: 'pie', title: 'Claim status distribution', xKey: 'status', series: [{ dataKey: 'claims', label: 'Claims' }], data: [{ status: 'Approved', claims: approved }, { status: 'Denied', claims: denied }, { status: 'Pending', claims: pending }], options: { donut: true } },
      outcomes_by_payer: sankey(pr),
      pending_aging: { chartType: 'bar', title: 'Pending claims by age', xKey: 'band', series: [{ dataKey: 'claims', label: 'Pending' }], data: aging },
    },
    items: rows.slice(offset, offset + limit), total: rows.length, limit, offset,
  };
}

// ------------------------------------------------------------------- denials
export function denials(f: DashboardFilters, top: number): DenialsResponse {
  const s = scope(f); const k = s.hk * s.monthShare * s.deptShare;
  const rows = PAYER_CLAIMS.filter(p => !s.payer || p.id === s.payer.id).map(p => ({
    payer_id: p.id, payer_name: p.name, total_claims: Math.round(p.total * k), denied_claims: Math.round(p.denied * k), pending_claims: Math.round(p.pending * k), denial_rate: p.denial,
  })).sort((a, b) => b.denial_rate - a.denial_rate);
  const denied = sum(rows.map(r => r.denied_claims)), eligible = sum(rows.map(r => r.total_claims));
  const rk = denied / 1345;
  const reasons = CARC.map(c => ({ ...c, count: Math.round(c.count * rk) })).slice(0, top);
  const rsum = sum(reasons.map(r => r.count)) || 1;
  const depts = DEPARTMENTS.filter(d => !s.dept || d === s.dept).map(d => ({ department: d, denial_rate: DEPT_DENIAL[d] })).sort((a, b) => b.denial_rate - a.denial_rate);
  return {
    period: s.period, last_refreshed: now(),
    totals: { denied_claims: denied, eligible_claims: eligible, denial_rate: eligible ? round1((denied / eligible) * 100) : 0, target_rate: DENIAL_TARGET },
    by_payer: rows.slice(0, top),
    reasons: reasons.map(r => ({ ...r, share: round1((r.count / rsum) * 100) })),
    charts: {
      by_payer: { chartType: 'bar', title: 'Denial rate by payer', xKey: 'payer', series: [{ dataKey: 'denial_rate', label: 'Denial rate' }], data: rows.slice(0, top).map(r => ({ payer: r.payer_name, denial_rate: r.denial_rate })), options: { orientation: 'horizontal', unit: '%', target: DENIAL_TARGET, highlightAbove: DENIAL_TARGET * 2 } },
      by_reason: { chartType: 'bar', title: 'Denials by reason code', xKey: 'code', series: [{ dataKey: 'count', label: 'Denials' }], data: reasons.map(r => ({ code: r.code, count: r.count })), options: { orientation: 'horizontal' } },
      by_department: { chartType: 'bar', title: 'Denial rate by department', xKey: 'department', series: [{ dataKey: 'denial_rate', label: 'Denial rate' }], data: depts, options: { orientation: 'horizontal', unit: '%', target: DENIAL_TARGET, highlightAbove: 11.5 } },
    },
  };
}

// -------------------------------------------------------------------- trends
export function trends(f: DashboardFilters, metric: string, groupBy: GroupBy | null, g: Granularity): TrendsResponse {
  const s = scope(f); const pl = periodLabel(s.months);
  let chart: VisualizationSpec;
  if (metric === 'denial_rate') {
    const vals = s.months.map(i => (s.payer ? round1(DENIAL_RATE_MONTHLY[i] * s.payer.denial / 10.1) : DENIAL_RATE_MONTHLY[i]));
    chart = { chartType: 'line', title: `Monthly denial rate, ${pl}`, xKey: 'month', series: [{ dataKey: 'denial_rate', label: 'Denial rate' }], data: s.months.map((i, j) => ({ month: MONTH_SHORT[i], denial_rate: vals[j] })), options: { unit: '%', target: DENIAL_TARGET, area: true, markPeak: true } };
  } else if (groupBy === 'department') {
    const ds = DEPARTMENTS.slice(0, 6).filter(d => !s.dept || d === s.dept);
    chart = { chartType: 'line', title: `Monthly admissions by department, ${pl}`, xKey: 'month', seriesKey: 'department', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: ds.flatMap(d => s.months.map(i => ({ month: MONTH_SHORT[i], department: d, admissions: Math.round(DEPT_ADMISSIONS[d][i] * s.hk) }))) };
  } else if (groupBy === 'hospital') {
    chart = { chartType: 'line', title: `Monthly admissions by hospital, ${pl}`, xKey: 'month', seriesKey: 'hospital', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: HOSPITALS.flatMap(h => s.months.map(i => ({ month: MONTH_SHORT[i], hospital: h.name, admissions: Math.round(admSeries(s.dept)[i] * h.share) }))) };
  } else {
    const b = bucketed(s.months.map(i => admSeries(s.dept)[i] * s.hk), s.months, g);
    chart = { chartType: 'line', title: `Admissions, ${pl}`, xKey: 'period', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: b.map(x => ({ period: x.label, admissions: x.value })), options: { area: true } };
  }
  return { metric, granularity: g, group_by: groupBy, chart };
}

// ------------------------------------------- helpers used by mock-analytics
export function pendingByPayer(): { payer: string; claims: number }[] {
  const counts = new Map<string, number>();
  for (const c of CLAIM_ROWS) if ((c.days_pending ?? 0) > 30) counts.set(c.payer_name, (counts.get(c.payer_name) ?? 0) + 1);
  return [...counts.entries()].map(([payer, claims]) => ({ payer, claims })).sort((a, b) => b.claims - a.claims);
}
export function pendingByPayerAndHospital(): { payer: string; hospital: string; claims: number }[] {
  const order = pendingByPayer().map(r => r.payer);
  return order.flatMap(payer => HOSPITALS.map(h => ({ payer, hospital: h.name, claims: CLAIM_ROWS.filter(c => c.payer_name === payer && c.hospital_name === h.name && (c.days_pending ?? 0) > 30).length })));
}
