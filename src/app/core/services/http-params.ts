import { HttpParams } from '@angular/common/http';
import { AskFilters, DashboardFilters } from '../models/api.models';

type Scalar = string | number | boolean | null | undefined;

/** Builds query params the way FastAPI expects: arrays as repeated keys (?hospital_id=H01&hospital_id=H02). */
export function toParams(f: Partial<DashboardFilters> = {}, extra: Record<string, Scalar | Scalar[]> = {}): HttpParams {
  let p = new HttpParams();
  const add = (k: string, v: Scalar | Scalar[]) => {
    if (Array.isArray(v)) { for (const x of v) if (x !== null && x !== undefined && x !== '') p = p.append(k, String(x)); }
    else if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  };
  for (const [k, v] of Object.entries(f)) add(k, v as Scalar | Scalar[]);
  for (const [k, v] of Object.entries(extra)) add(k, v);
  return p;
}

/**
 * DashboardFilters -> AskFilters (AskRequest.filters has no claim_status / claim_type). Empty arrays become null.
 * Dates are left out by default so the question's own period ("last 2 months") is not overridden by the page's
 * period filter; pass includeDates=true to force the selected period.
 */
export function toAskFilters(f: DashboardFilters, includeDates = false): AskFilters {
  const arr = (a: string[]) => (a.length ? a : null);
  return {
    ...(includeDates ? { date_from: f.date_from, date_to: f.date_to } : {}),
    hospital_id: arr(f.hospital_id), department_id: arr(f.department_id), payer_id: arr(f.payer_id),
  };
}
