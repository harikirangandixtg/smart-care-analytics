import { KpiUnit } from '../../core/models/api.models';

/** ₹ in crore above 1 Cr, lakh above 1 L, else rupees (Indian grouping). */
export function inr(v: number): string {
  const one = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (Math.abs(v) >= 1e7) return `₹${one(v / 1e7)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${one(v / 1e5)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

export function formatValue(v: number | null | undefined, unit: KpiUnit): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'Not available';
  switch (unit) {
    case 'currency_inr': return inr(v);
    case 'percent': return `${v.toFixed(1)}%`;
    case 'days': return `${v.toFixed(1)} days`;
    case 'decimal': return v.toLocaleString('en-IN', { maximumFractionDigits: 1 });
    default: return Math.round(v).toLocaleString('en-IN');
  }
}

export const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '—');
