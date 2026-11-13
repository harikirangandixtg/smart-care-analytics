import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdmissionsResponse, ClaimsResponse, DashboardFilters, Granularity, Page, PendingClaim, SummaryResponse,
} from '../models/api.models';
import { filterParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/dashboard`;

  summary(f: DashboardFilters): Observable<SummaryResponse> {
    return this.http.get<SummaryResponse>(`${this.base}/summary`, { params: filterParams(f) });
  }

  admissions(f: DashboardFilters, granularity: Granularity = 'month'): Observable<AdmissionsResponse> {
    return this.http.get<AdmissionsResponse>(`${this.base}/admissions`, { params: filterParams(f, { granularity }) });
  }

  claims(f: DashboardFilters, payer?: string): Observable<ClaimsResponse> {
    return this.http.get<ClaimsResponse>(`${this.base}/claims`, { params: filterParams(f, { payer }) });
  }

  pendingClaims(f: DashboardFilters, opts: { minDays?: number; payer?: string; page?: number; size?: number } = {}): Observable<Page<PendingClaim>> {
    return this.http.get<Page<PendingClaim>>(`${this.base}/claims/pending`, {
      params: filterParams(f, { min_days: opts.minDays ?? 30, payer: opts.payer, page: opts.page ?? 1, size: opts.size ?? 6 }),
    });
  }
}
