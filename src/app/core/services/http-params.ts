import { HttpParams } from '@angular/common/http';
import { DashboardFilters } from '../models/api.models';

export function filterParams(f: DashboardFilters, extra: Record<string, string | number | undefined> = {}): HttpParams {
  let p = new HttpParams().set('from', f.from).set('to', f.to);
  for (const id of f.hospitalIds) p = p.append('hospital_ids', id);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') p = p.set(k, String(v));
  return p;
}
