import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdmissionsResponse, ClaimsResponse, DashboardFilters, DenialsResponse, DimensionResponse, Granularity, GroupBy,
  RevenueResponse, SummaryResponse, TrendsResponse,
} from '../models/api.models';
import { normalizeAdmissions, normalizeClaims, normalizeDenials, normalizeDimension, normalizeRevenue, normalizeSummary, normalizeTrends } from './dashboard-adapter';
import { toParams } from './http-params';

/** /api/dashboard/* — every call takes the common filters from the OpenAPI spec. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/dashboard`;

  summary(f: DashboardFilters, granularity: Granularity = 'month'): Observable<SummaryResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/summary`, { params: toParams(f, { granularity }) }).pipe(map(normalizeSummary));
  }

  admissions(f: DashboardFilters, granularity: Granularity = 'month', top = 8): Observable<AdmissionsResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/admissions`, { params: toParams(f, { granularity, top }) }).pipe(map(normalizeAdmissions));
  }

  revenue(f: DashboardFilters, granularity: Granularity = 'month', top = 8): Observable<RevenueResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/revenue`, { params: toParams(f, { granularity, top }) }).pipe(map(normalizeRevenue));
  }

  /** Claim KPIs + paged claim rows. Use claim_status=['Pending'] in the filters for the pending list. */
  claims(f: DashboardFilters, limit = 25, offset = 0, granularity: Granularity = 'month'): Observable<ClaimsResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/claims`, { params: toParams(f, { granularity, limit, offset }) }).pipe(map(normalizeClaims));
  }

  denials(f: DashboardFilters, top = 8, granularity: Granularity = 'month'): Observable<DenialsResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/denials`, { params: toParams(f, { granularity, top }) }).pipe(map(normalizeDenials));
  }

  departments(f: DashboardFilters): Observable<DimensionResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/departments`, { params: toParams(f) }).pipe(map(r => normalizeDimension(r, 'department')));
  }

  hospitals(f: DashboardFilters): Observable<DimensionResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/hospitals`, { params: toParams(f) }).pipe(map(r => normalizeDimension(r, 'hospital')));
  }

  /** metric: e.g. admissions | denial_rate | submitted_amount; group_by: hospital | department | payer. */
  trends(f: DashboardFilters, metric = 'admissions', groupBy: GroupBy | null = null, granularity: Granularity = 'month'): Observable<TrendsResponse> {
    return this.http.get<Record<string, unknown>>(`${this.base}/trends`, { params: toParams(f, { granularity, metric, group_by: groupBy }) }).pipe(map(normalizeTrends));
  }
}
