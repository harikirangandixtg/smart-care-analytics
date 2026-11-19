import { KpiUnit } from '../../core/models/api.models';

/** US dollars: $1.4B, $2.2M, else the full amount with US grouping ($12,345). */
export function usd(v: number): string {
  const one = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${one(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}$${one(a / 1e6)}M`;
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
}

export function formatValue(v: number | null | undefined, unit: KpiUnit): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'Not available';
  switch (unit) {
    case 'currency': return usd(v);
    case 'percent': return `${v.toFixed(1)}%`;
    case 'days': return `${v.toFixed(1)} days`;
    case 'decimal': return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
    default: return Math.round(v).toLocaleString('en-US');
  }
}

export const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '—');
