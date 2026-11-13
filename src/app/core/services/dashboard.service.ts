import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdmissionsResponse, ClaimsResponse, DashboardFilters, DenialsResponse, DimensionResponse, Granularity, GroupBy,
  RevenueResponse, SummaryResponse, TrendsResponse,
} from '../models/api.models';
import { toParams } from './http-params';

/** /api/dashboard/* — every call takes the common filters from the OpenAPI spec. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/dashboard`;

  summary(f: DashboardFilters, granularity: Granularity = 'month'): Observable<SummaryResponse> {
    return this.http.get<SummaryResponse>(`${this.base}/summary`, { params: toParams(f, { granularity }) });
  }

  admissions(f: DashboardFilters, granularity: Granularity = 'month', top = 8): Observable<AdmissionsResponse> {
    return this.http.get<AdmissionsResponse>(`${this.base}/admissions`, { params: toParams(f, { granularity, top }) });
  }

  revenue(f: DashboardFilters, granularity: Granularity = 'month', top = 8): Observable<RevenueResponse> {
    return this.http.get<RevenueResponse>(`${this.base}/revenue`, { params: toParams(f, { granularity, top }) });
  }

  /** Claim KPIs + paged claim rows. Use claim_status=['Pending'] in the filters for the pending list. */
  claims(f: DashboardFilters, limit = 25, offset = 0, granularity: Granularity = 'month'): Observable<ClaimsResponse> {
    return this.http.get<ClaimsResponse>(`${this.base}/claims`, { params: toParams(f, { granularity, limit, offset }) });
  }

  denials(f: DashboardFilters, top = 8, granularity: Granularity = 'month'): Observable<DenialsResponse> {
    return this.http.get<DenialsResponse>(`${this.base}/denials`, { params: toParams(f, { granularity, top }) });
  }

  departments(f: DashboardFilters): Observable<DimensionResponse> {
    return this.http.get<DimensionResponse>(`${this.base}/departments`, { params: toParams(f) });
  }

  hospitals(f: DashboardFilters): Observable<DimensionResponse> {
    return this.http.get<DimensionResponse>(`${this.base}/hospitals`, { params: toParams(f) });
  }

  /** metric: e.g. admissions | denial_rate | submitted_amount; group_by: hospital | department | payer. */
  trends(f: DashboardFilters, metric = 'admissions', groupBy: GroupBy | null = null, granularity: Granularity = 'month'): Observable<TrendsResponse> {
    return this.http.get<TrendsResponse>(`${this.base}/trends`, { params: toParams(f, { granularity, metric, group_by: groupBy }) });
  }
}
