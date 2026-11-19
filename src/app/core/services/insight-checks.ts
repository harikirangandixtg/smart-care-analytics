// Deterministic checks on an /ask result, used by the AI Insights screen.
// Everything here works only on the rows the API returned: no new measures, no causes, no advice.
//   • grounding  — every figure in the Insights Agent's text must appear in the result rows
//   • baseline   — latest vs previous period and vs the period average (time series), or
//                  highest / lowest vs the average across rows (categories)
//   • flags      — values or period-over-period changes outside the typical range (IQR rule),
//                  worded as "flagged for review", never as a cause
import { AskResponse } from '../models/api.models';

type Row = Record<string, string | number | null>;
export type Unit = 'percent' | 'currency' | 'days' | 'count' | 'decimal';

export interface Shape {
  xKey: string;
  valueKey: string;
  valueLabel: string;
  unit: Unit;
  isTime: boolean;
  rows: { x: string; v: number; row: Row }[];
  denominatorKey: string | null;
  numeratorKey: string | null;
}
export interface Grounding { checked: number; matched: number; unmatched: string[]; bounds: string[]; derived: string[] }
export interface Comparison { label: string; text: string; direction: 'up' | 'down' | 'flat' | null }
export interface Flag { subject: string; text: string; value: string }

const DENOMS = ['total_claims', 'claims', 'eligible_claims', 'claims_filed', 'admissions', 'total_admissions', 'patients', 'unique_patients', 'denominator'];
const NUMERATORS = ['denied_claims', 'pending_claims', 'paid_claims', 'approved_claims', 'numerator'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null);
const title = (k: string) => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

function unitOf(res: AskResponse, key: string): Unit {
  const u = String((res as unknown as { unit?: string }).unit ?? res.chart?.options?.unit ?? '').trim().toLowerCase();
  if (u === '%' || u === 'percent' || /rate|pct|share/.test(key)) return 'percent';
  if (/amount|revenue|usd|\$/.test(key) || u === 'currency' || u === 'usd' || u === '$' || u === 'm') return 'currency';
  if (/los|length_of_stay|days/.test(key) || u === 'd' || u === 'days') return 'days';
  return 'count';
}

export function fmt(v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'percent') return `${v.toFixed(2)}%`;
  if (unit === 'days') return `${v.toFixed(2)} days`;
  if (unit === 'currency') return Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v).toLocaleString('en-US')}`;
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) >= 100 ? 1 : 2 });
}
/** Difference wording: percentage points for rates, % change otherwise. */
function delta(a: number, b: number, unit: Unit): string {
  if (unit === 'percent') { const d = a - b; return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} pts`; }
  if (b === 0) return 'n/a';
  const p = ((a - b) / Math.abs(b)) * 100;
  return `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`;
}

export function periodLabel(x: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(x);
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : x;
}

/** Works out which column is the category / period and which is the measure. */
export function shapeOf(res: AskResponse): Shape | null {
  const rows: Row[] = (res.table?.rows ?? res.chart?.data ?? []) as Row[];
  if (!rows.length) return null;
  const cols = res.table?.columns ?? Object.keys(rows[0]);
  const numeric = cols.filter(c => rows.every(r => r[c] === null || num(r[c]) !== null) && rows.some(r => num(r[c]) !== null));
  const xKey = res.chart?.xKey && cols.includes(res.chart.xKey) ? res.chart.xKey : cols.find(c => !numeric.includes(c)) ?? cols[0];
  const preferred = [res.chart?.series?.[0]?.dataKey, res.metric ?? undefined].filter((k): k is string => !!k && numeric.includes(k));
  const valueKey = preferred[0] ?? [...numeric].reverse().find(c => c !== xKey && !DENOMS.includes(c) && !NUMERATORS.includes(c)) ?? numeric.find(c => c !== xKey);
  if (!valueKey) return null;
  const isTime = /period|month|week|quarter|date|year/i.test(xKey) || rows.every(r => /^\d{4}-\d{2}/.test(String(r[xKey])));
  const unit = unitOf(res, valueKey);
  return {
    xKey, valueKey, unit, isTime,
    valueLabel: res.metric_label && res.metric === valueKey ? res.metric_label : res.chart?.series?.find(s => s.dataKey === valueKey)?.label ?? title(valueKey),
    rows: rows.map(r => ({ x: isTime ? periodLabel(String(r[xKey])) : String(r[xKey] ?? '—'), v: num(r[valueKey]) as number, row: r })).filter(r => r.v !== null),
    denominatorKey: DENOMS.find(d => cols.includes(d) && d !== valueKey) ?? null,
    numeratorKey: NUMERATORS.find(n => cols.includes(n) && n !== valueKey) ?? null,
  };
}

/**
 * Every figure the Insights Agent wrote must be traceable to the result: a returned cell, a column total,
 * or a change / difference between two returned values of the same column. Bounds and targets
 * ("below 8%", "the 8% target") are listed separately; anything else is reported as unmatched.
 */
export function checkGrounding(texts: string[], res: AskResponse): Grounding {
  const rows: Row[] = (res.table?.rows ?? res.chart?.data ?? []) as Row[];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const columns = cols.map(c => rows.map(r => num(r[c])).filter((v): v is number => v !== null)).filter(v => v.length);
  const cells = columns.flat();
  const totals = columns.map(v => v.reduce((a, b) => a + b, 0));
  const derived: number[] = [];
  for (const v of columns) {
    if (v.length > 60) continue;
    for (const a of v) for (const b of v) if (a !== b) { derived.push(a - b); if (b !== 0) derived.push(((a - b) / Math.abs(b)) * 100, a / b); }
  }
  const near = (list: number[], v: number, rel: number, abs: number) => list.some(c => Math.abs(c - v) <= Math.max(abs, Math.abs(c) * rel));
  const unmatched: string[] = [];
  const bounds: string[] = [];
  const fromChange: string[] = [];
  let checked = 0;
  for (const t of texts) {
    // strip dates, years and ordinals first: they are context, not figures
    const clean = t.replace(/\b\d{4}-\d{2}(-\d{2})?\b/g, ' ').replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\b\d+(st|nd|rd|th)\b/gi, ' ');
    for (const m of clean.matchAll(/(\$\s?)?(\d[\d,]*(?:\.\d+)?)\s*(%|bn\b|billion|b\b|million|mn\b|m\b|thousand|k\b|days?|x\b|times)?/gi)) {
      const raw = m[0].trim();
      const v0 = parseFloat(m[2].replace(/,/g, ''));
      if (!Number.isFinite(v0)) continue;
      if (v0 <= 12 && !m[3] && !m[1] && Number.isInteger(v0)) continue; // small counts like "two months", "3 of 8 payers"
      const before = clean.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
      const after = clean.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 22);
      // bounds and references ("below 8%", "between 4% and 8%", "the 8% denial target", "more than 30 days")
      if (/(below|above|under|over|between|than|at least|at most|up to|within|target(?: of)?|threshold(?: of)?|\d%? and)\s*$/i.test(before) || /^\s*(?:\w+\s)?(target|threshold|benchmark|limit)\b/i.test(after)) { bounds.push(raw); continue; }
      checked++;
      const u = (m[3] ?? '').toLowerCase();
      const scale = /^(b|bn|billion)$/.test(u) ? 1e9 : /^(m|mn|million)$/.test(u) ? 1e6 : /^(k|thousand)$/.test(u) ? 1e3 : 1;
      // amounts: rounded to 2 dp in the unit written, and the column may hold dollars or $ millions already
      const ok = (v: number, rel: number, abs: number) => near(cells, v, rel, abs) || near(totals, v, rel, abs);
      if (scale > 1 ? ok(v0 * scale, 0.01, 0.006 * scale) || ok(v0, 0.01, 0.006) : ok(v0, 0.002, 0.051)) continue;
      // a change / difference / ratio is accepted only when the text presents it as one
      const signed = /[+−-]\s*$/.test(before) || /\(\s*[+−-]?\s*$/.test(before);
      const changeWord = /(rose|rise|fell|fall|increase|decrease|grew|growth|drop|declin|change|up by|down by|higher by|lower by|gap of|difference)/i.test(clean.slice(Math.max(0, (m.index ?? 0) - 45), m.index));
      const pts = /^\s*(pts|points|percentage points|pp)\b/i.test(after);
      const ratio = /^(x|times)$/i.test(m[3] ?? '');
      if ((signed || changeWord || pts || ratio) && near(derived, v0, 0.01, 0.06)) { fromChange.push(raw); continue; }
      unmatched.push(raw);
    }
  }
  return { checked, matched: checked - unmatched.length, unmatched: [...new Set(unmatched)], bounds: [...new Set(bounds)], derived: [...new Set(fromChange)] };
}

/** Comparison with the previous period / the period or cross-row average. */
export function baseline(s: Shape): Comparison[] {
  const out: Comparison[] = [];
  const vals = s.rows.map(r => r.v);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const dir = (a: number, b: number): Comparison['direction'] => (Math.abs(a - b) < 1e-9 ? 'flat' : a > b ? 'up' : 'down');
  if (s.isTime && s.rows.length >= 2) {
    const last = s.rows[s.rows.length - 1], prev = s.rows[s.rows.length - 2], first = s.rows[0];
    out.push({ label: 'Latest vs previous period', direction: dir(last.v, prev.v), text: `${last.x}: ${fmt(last.v, s.unit)} vs ${prev.x}: ${fmt(prev.v, s.unit)} (${delta(last.v, prev.v, s.unit)})` });
    out.push({ label: 'Latest vs period average', direction: dir(last.v, avg), text: `${fmt(last.v, s.unit)} vs average ${fmt(avg, s.unit)} across ${s.rows.length} periods (${delta(last.v, avg, s.unit)})` });
    if (s.rows.length > 2) out.push({ label: 'Start to end of period', direction: dir(last.v, first.v), text: `${first.x}: ${fmt(first.v, s.unit)} → ${last.x}: ${fmt(last.v, s.unit)} (${delta(last.v, first.v, s.unit)})` });
  } else if (s.rows.length >= 2) {
    const sorted = [...s.rows].sort((a, b) => b.v - a.v);
    const hi = sorted[0], lo = sorted[sorted.length - 1];
    out.push({ label: 'Highest vs average', direction: dir(hi.v, avg), text: `${hi.x}: ${fmt(hi.v, s.unit)} vs simple average ${fmt(avg, s.unit)} of ${s.rows.length} rows (${delta(hi.v, avg, s.unit)})` });
    out.push({ label: 'Highest vs lowest', direction: dir(hi.v, lo.v), text: `${hi.x}: ${fmt(hi.v, s.unit)} vs ${lo.x}: ${fmt(lo.v, s.unit)}` });
  }
  return out;
}

function quartiles(v: number[]): [number, number] {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  return [q(0.25), q(0.75)];
}

/** Values (categories) or period-over-period changes (time) outside Q1 − 1.5·IQR … Q3 + 1.5·IQR. Needs ≥ 5 points. */
export function flags(s: Shape): Flag[] {
  const out: Flag[] = [];
  if (s.isTime) {
    const ch = s.rows.slice(1).map((r, i) => ({ r, prev: s.rows[i], d: r.v - s.rows[i].v }));
    if (ch.length < 4) return out;
    const [q1, q3] = quartiles(ch.map(c => c.d));
    const iqr = q3 - q1;
    for (const c of ch) {
      if (iqr > 0 && (c.d > q3 + 1.5 * iqr || c.d < q1 - 1.5 * iqr)) {
        out.push({ subject: `${c.prev.x} → ${c.r.x}`, value: delta(c.r.v, c.prev.v, s.unit),
          text: `${s.valueLabel} moved from ${fmt(c.prev.v, s.unit)} to ${fmt(c.r.v, s.unit)}, a larger change than in other periods.` });
      }
    }
  } else {
    if (s.rows.length < 5) return out;
    const [q1, q3] = quartiles(s.rows.map(r => r.v));
    const iqr = q3 - q1;
    const median = [...s.rows].map(r => r.v).sort((a, b) => a - b)[Math.floor(s.rows.length / 2)];
    for (const r of s.rows) {
      const high = r.v > q3 + 1.5 * iqr, low = r.v < q1 - 1.5 * iqr;
      if (iqr > 0 && (high || low)) {
        out.push({ subject: r.x, value: fmt(r.v, s.unit),
          text: `${s.valueLabel} is ${high ? 'well above' : 'well below'} the other ${s.rows.length - 1} (median ${fmt(median, s.unit)}).` });
      }
    }
  }
  return out;
}

/** "519 denied of 2,540 claims" for a row, when the result carries the counts. */
export function denominatorText(s: Shape, row: Row): string | null {
  if (!s.denominatorKey) return null;
  const d = num(row[s.denominatorKey]);
  const n = s.numeratorKey ? num(row[s.numeratorKey]) : null;
  if (d === null) return null;
  return n !== null ? `${fmt(n, 'count')} ${title(s.numeratorKey!).toLowerCase()} of ${fmt(d, 'count')} ${title(s.denominatorKey).toLowerCase()}`
    : `${fmt(d, 'count')} ${title(s.denominatorKey).toLowerCase()}`;
}
