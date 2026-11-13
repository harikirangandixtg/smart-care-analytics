// Static synthetic POC data. Shapes follow api.models.ts exactly, so the real
// FastAPI responses can replace these one endpoint at a time.
import {
  AdmissionsResponse, ClaimsResponse, DashboardFilters, FilterOptions, Granularity, Page, PendingClaim,
  SummaryResponse, VisualizationSpec,
} from '../models/api.models';

export const MONTH_KEYS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];

export const HOSPITALS = [
  { id: 'H01', name: 'Hospital 01', share: 0.42 },
  { id: 'H02', name: 'Hospital 02', share: 0.33 },
  { id: 'H03', name: 'Hospital 03', share: 0.25 },
];

export const ADMISSIONS_TOTAL = [980, 1010, 1045, 1020, 1090, 1130, 1175, 1160, 1210, 1245];

export const DEPT_ADMISSIONS: Record<string, number[]> = {
  Cardiology: [150, 152, 160, 158, 168, 175, 212, 236, 241, 229],
  Orthopedics: [140, 138, 145, 142, 148, 150, 149, 152, 155, 158],
  'General Medicine': [135, 140, 150, 146, 150, 152, 149, 147, 151, 155],
  Neurology: [110, 112, 113, 111, 115, 118, 117, 116, 120, 122],
  Oncology: [100, 101, 104, 103, 106, 108, 107, 109, 112, 114],
  Pediatrics: [125, 122, 108, 100, 97, 95, 96, 99, 103, 110],
};
export const DEPARTMENTS = Object.keys(DEPT_ADMISSIONS);

export const CLAIMS_MONTHLY = [1210, 1240, 1290, 1270, 1320, 1350, 1380, 1370, 1410, 1440];
export const CLAIM_AMOUNT_CR = [4.3, 4.4, 4.6, 4.5, 4.8, 4.9, 5.1, 5.0, 5.4, 5.6];
export const DENIAL_RATE_MONTHLY = [7.4, 7.6, 7.9, 8.1, 8.4, 8.6, 9.0, 9.3, 9.6, 9.8];
export const LOS_MONTHLY = [4.3, 4.3, 4.4, 4.5, 4.5, 4.6, 4.7, 4.6, 4.7, 4.8];

export const PAYERS = [
  { name: 'Payer A', share: 0.16, denial: 21.4, pending: 0.076 },
  { name: 'Payer B', share: 0.15, denial: 9.8, pending: 0.04 },
  { name: 'Payer C', share: 0.14, denial: 8.6, pending: 0.037 },
  { name: 'Payer D', share: 0.13, denial: 7.9, pending: 0.032 },
  { name: 'Payer E', share: 0.12, denial: 7.1, pending: 0.033 },
  { name: 'Payer F', share: 0.11, denial: 6.5, pending: 0.03 },
  { name: 'Payer G', share: 0.10, denial: 5.8, pending: 0.03 },
  { name: 'Payer H', share: 0.09, denial: 5.2, pending: 0.03 },
];
export const DENIAL_TARGET = 8;

export const LOS_BY_DEPT = [
  { department: 'Cardiology', min: 2, q1: 3, median: 4.2, q3: 6, max: 10 },
  { department: 'Orthopedics', min: 2, q1: 3, median: 4, q3: 5, max: 9 },
  { department: 'General Medicine', min: 1, q1: 2, median: 3.4, q3: 5, max: 8 },
  { department: 'Neurology', min: 3, q1: 5, median: 6.8, q3: 9, max: 15 },
  { department: 'Oncology', min: 2, q1: 4, median: 5.5, q3: 8, max: 13 },
  { department: 'Pediatrics', min: 1, q1: 2, median: 2.6, q3: 4, max: 7 },
];

// ---------- helpers ----------
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

/** Month indexes covered by [from, to]. */
export function monthRange(from: string, to: string): number[] {
  const f = from.slice(0, 7), t = to.slice(0, 7);
  const idx = MONTH_KEYS.map((m, i) => (m >= f && m <= t ? i : -1)).filter(i => i >= 0);
  return idx.length ? idx : MONTH_KEYS.map((_, i) => i);
}

export function periodLabel(idx: number[]): string {
  return `${MONTH_SHORT[idx[0]]} – ${MONTH_SHORT[idx[idx.length - 1]]} 2026`;
}

export function hospitalScale(ids: string[]): number {
  if (!ids.length) return 1;
  return sum(HOSPITALS.filter(h => ids.includes(h.id)).map(h => h.share)) || 1;
}

export function scopeLabel(ids: string[]): string {
  if (!ids.length) return `All in scope (${HOSPITALS.length})`;
  return HOSPITALS.filter(h => ids.includes(h.id)).map(h => h.name).join(', ');
}

const pick = (xs: number[], idx: number[]) => idx.map(i => xs[i]);

// ---------- /api/meta/filters ----------
export function filterOptions(): FilterOptions {
  return {
    hospitals: HOSPITALS.map(({ id, name }) => ({ id, name })),
    departments: DEPARTMENTS,
    payers: PAYERS.map(p => p.name),
    dataFrom: '2026-01-01',
    dataTo: '2026-10-31',
  };
}

// ---------- /api/dashboard/summary ----------
export function summary(f: DashboardFilters): SummaryResponse {
  const idx = monthRange(f.from, f.to);
  const k = hospitalScale(f.hospitalIds);
  const adm = pick(ADMISSIONS_TOTAL, idx).map(v => v * k);
  const claims = pick(CLAIMS_MONTHLY, idx).map(v => v * k);
  const amount = pick(CLAIM_AMOUNT_CR, idx).map(v => v * k);
  const denial = pick(DENIAL_RATE_MONTHLY, idx);
  const los = pick(LOS_MONTHLY, idx);
  // same calculation as /claims so the KPI card and the gauge agree
  const payerRows = PAYERS.map(p => Math.round(sum(claims) * p.share));
  const deniedTotal = sum(PAYERS.map((p, i) => Math.round(payerRows[i] * p.denial / 100)));
  const denialRate = round1((deniedTotal / sum(payerRows)) * 100);
  const avgLos = round1(sum(los) / los.length);
  return {
    period: { from: f.from, to: f.to },
    comparisonLabel: 'vs same period 2025',
    kpis: [
      { key: 'admissions', label: 'Admissions', value: Math.round(sum(adm)), display: fmtInt(sum(adm)),
        change: { label: '+6.2%', direction: 'up', favourable: true }, sparkline: adm.map(Math.round) },
      { key: 'patients', label: 'Unique patients', value: Math.round(sum(adm) * 0.67), display: fmtInt(sum(adm) * 0.67),
        change: { label: '+4.8%', direction: 'up', favourable: true }, sparkline: adm.map(v => Math.round(v * 0.67)) },
      { key: 'claim_amount', label: 'Claim amount', value: round1(sum(amount)), display: `₹${round1(sum(amount))} Cr`,
        change: { label: '+7.9%', direction: 'up', favourable: true }, sparkline: amount.map(round1) },
      { key: 'claims', label: 'Claims', value: Math.round(sum(claims)), display: fmtInt(sum(claims)),
        change: { label: '+5.1%', direction: 'up', favourable: true }, sparkline: claims.map(Math.round) },
      { key: 'denial_rate', label: 'Denial rate', value: denialRate, display: `${denialRate}%`,
        change: { label: '+1.3 pts', direction: 'up', favourable: false }, sparkline: denial },
      { key: 'avg_los', label: 'Avg length of stay', value: avgLos, display: `${avgLos} days`,
        change: { label: '+0.3 d', direction: 'up', favourable: false }, sparkline: los },
    ],
  };
}

// ---------- /api/dashboard/admissions ----------
function weeklySeries(idx: number[], k: number): { label: string; value: number }[] {
  const rnd = seeded(42);
  const out: { label: string; value: number }[] = [];
  for (const i of idx) {
    for (let w = 0; w < 4; w++) {
      const v = (ADMISSIONS_TOTAL[i] / 4.33) * (0.93 + rnd() * 0.14) * k;
      out.push({ label: `${MONTH_SHORT[i]} ${1 + w * 7}`, value: Math.round(v) });
    }
  }
  return out;
}

export function admissions(f: DashboardFilters, granularity: Granularity): AdmissionsResponse {
  const idx = monthRange(f.from, f.to);
  const k = hospitalScale(f.hospitalIds);
  const pl = periodLabel(idx);

  const trendData = granularity === 'week'
    ? weeklySeries(idx, k).map(p => ({ period: p.label, admissions: p.value }))
    : idx.map(i => ({ period: MONTH_SHORT[i], admissions: Math.round(ADMISSIONS_TOTAL[i] * k) }));

  const deptTotals = DEPARTMENTS
    .map(d => ({ department: d, admissions: Math.round(sum(pick(DEPT_ADMISSIONS[d], idx)) * k) }))
    .sort((a, b) => b.admissions - a.admissions);

  const hospitals = (f.hospitalIds.length ? HOSPITALS.filter(h => f.hospitalIds.includes(h.id)) : HOSPITALS)
    .map(h => ({ hospital: h.name, admissions: Math.round(sum(pick(ADMISSIONS_TOTAL, idx)) * h.share) }));

  const heat: VisualizationSpec['data'] = [];
  for (const d of DEPARTMENTS) for (const i of idx) {
    heat.push({ month: MONTH_SHORT[i], department: d, admissions: Math.round(DEPT_ADMISSIONS[d][i] * k) });
  }

  return {
    granularity,
    trend: {
      chartType: 'line', title: `${granularity === 'week' ? 'Weekly' : 'Monthly'} admissions, ${pl}`,
      xKey: 'period', series: [{ dataKey: 'admissions', label: 'Admissions' }], data: trendData,
      options: { area: true, markPeak: true },
    },
    byDepartment: {
      chartType: 'bar', title: `Admissions by department, ${pl}`, xKey: 'department',
      series: [{ dataKey: 'admissions', label: 'Admissions' }], data: deptTotals, options: { orientation: 'horizontal' },
    },
    byHospital: {
      chartType: 'bar', title: `Admissions by hospital, ${pl}`, xKey: 'hospital',
      series: [{ dataKey: 'admissions', label: 'Admissions' }], data: hospitals, options: { orientation: 'horizontal' },
    },
    heatmap: {
      chartType: 'heatmap', title: `Admissions, department × month, ${pl}`, xKey: 'month', seriesKey: 'department',
      series: [{ dataKey: 'admissions', label: 'Admissions' }], data: heat,
    },
    losDistribution: {
      chartType: 'boxplot', title: 'Length of stay by department (days)', xKey: 'department',
      series: [{ dataKey: 'median', label: 'Length of stay (days)' }], data: LOS_BY_DEPT, options: { unit: ' d' },
    },
  };
}

// ---------- /api/dashboard/claims ----------
export function claims(f: DashboardFilters, payer?: string): ClaimsResponse {
  const idx = monthRange(f.from, f.to);
  const k = hospitalScale(f.hospitalIds);
  const totalClaims = sum(pick(CLAIMS_MONTHLY, idx)) * k;
  const pl = periodLabel(idx);

  const rows = PAYERS.map(p => {
    const count = Math.round(totalClaims * p.share);
    const denied = Math.round(count * p.denial / 100);
    const pending = Math.round(count * p.pending);
    return { ...p, count, denied, pending, paid: count - denied - pending };
  });
  const scoped = payer ? rows.filter(r => r.name === payer) : rows;

  const total = sum(scoped.map(r => r.count));
  const denied = sum(scoped.map(r => r.denied));
  const pending = sum(scoped.map(r => r.pending));
  const denialRate = total ? round1((denied / total) * 100) : 0;

  // Sankey: top 4 payers individually, the rest grouped.
  const named = payer ? scoped : scoped.slice(0, 4);
  const others = payer ? [] : scoped.slice(4);
  const groups = [...named.map(r => ({ name: r.name, paid: r.paid, denied: r.denied, pending: r.pending }))];
  if (others.length) {
    groups.push({ name: 'Other payers', paid: sum(others.map(r => r.paid)), denied: sum(others.map(r => r.denied)), pending: sum(others.map(r => r.pending)) });
  }
  const links: VisualizationSpec['data'] = [];
  for (const g of groups) {
    links.push({ source: g.name, target: 'Paid', value: g.paid });
    links.push({ source: g.name, target: 'Denied', value: g.denied });
    links.push({ source: g.name, target: 'Pending', value: g.pending });
  }

  const a = rows[0];
  const allDenied = sum(rows.map(r => r.denied));
  const allTotal = sum(rows.map(r => r.count));

  return {
    denialByPayer: {
      chartType: 'bar', title: `Denial rate by payer, ${pl}`, xKey: 'payer',
      series: [{ dataKey: 'denialRate', label: 'Denial rate' }],
      data: [...rows].sort((x, y) => y.denial - x.denial).map(r => ({ payer: r.name, denialRate: r.denial })),
      options: { orientation: 'horizontal', unit: '%', target: DENIAL_TARGET, highlightAbove: DENIAL_TARGET * 2 },
    },
    outcomes: {
      chartType: 'sankey', title: `Claim outcomes by payer, ${pl}`,
      series: [{ dataKey: 'value', label: 'Claims' }], data: links,
    },
    denialGauge: {
      chartType: 'gauge', title: 'Denial rate vs target',
      series: [{ dataKey: 'value', label: 'Denial rate' }], data: [{ value: denialRate }],
      options: { unit: '%', target: DENIAL_TARGET, max: 20 },
    },
    totals: { claims: total, denied, pending, denialRate, target: DENIAL_TARGET },
    topDenier: payer ? undefined : {
      payer: a.name,
      shareOfDenied: Math.round((a.denied / allDenied) * 100),
      shareOfVolume: Math.round((a.count / allTotal) * 100),
    },
  };
}

// ---------- /api/dashboard/claims/pending ----------
const PENDING: PendingClaim[] = (() => {
  const rnd = seeded(7);
  const weighted = PAYERS.flatMap(p => Array(Math.round(p.pending * p.share * 1000)).fill(p.name) as string[]);
  const out: PendingClaim[] = [];
  for (let n = 0; n < 142; n++) {
    const h = HOSPITALS[Math.floor(rnd() * HOSPITALS.length)];
    out.push({
      claimId: `CLM-${207000 + Math.floor(rnd() * 5000)}`,
      hospital: h.name,
      department: DEPARTMENTS[Math.floor(rnd() * DEPARTMENTS.length)],
      payer: weighted[Math.floor(rnd() * weighted.length)],
      amount: Math.round((20000 + rnd() * rnd() * 380000) / 50) * 50,
      daysPending: 31 + Math.floor(rnd() * rnd() * 60),
    });
  }
  return out.sort((x, y) => y.daysPending - x.daysPending || y.amount - x.amount);
})();

export function pendingClaims(f: DashboardFilters, minDays: number, payer: string | undefined, page: number, size: number): Page<PendingClaim> {
  const names = f.hospitalIds.length ? HOSPITALS.filter(h => f.hospitalIds.includes(h.id)).map(h => h.name) : null;
  const rows = PENDING.filter(c => c.daysPending > minDays && (!payer || c.payer === payer) && (!names || names.includes(c.hospital)));
  const start = (page - 1) * size;
  return { items: rows.slice(start, start + size), total: rows.length, page, size };
}

export function pendingByPayer(): { payer: string; claims: number }[] {
  const counts = new Map<string, number>();
  for (const c of PENDING) counts.set(c.payer, (counts.get(c.payer) ?? 0) + 1);
  return [...counts.entries()].map(([payer, claims]) => ({ payer, claims })).sort((a, b) => b.claims - a.claims);
}

export function pendingByPayerAndHospital(): { payer: string; hospital: string; claims: number }[] {
  const order = pendingByPayer().map(r => r.payer);
  const out: { payer: string; hospital: string; claims: number }[] = [];
  for (const payer of order) for (const h of HOSPITALS) {
    out.push({ payer, hospital: h.name, claims: PENDING.filter(c => c.payer === payer && c.hospital === h.name).length });
  }
  return out;
}
