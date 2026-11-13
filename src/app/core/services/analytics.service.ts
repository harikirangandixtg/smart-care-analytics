import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AskRequest, AskResponse, FollowupRequest, HistoryResponse } from '../models/api.models';

/** /api/analytics/* — the x-session-id header is added by sessionInterceptor. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/analytics`;

  ask(req: AskRequest): Observable<AskResponse> {
    return this.http.post<AskResponse>(`${this.base}/ask`, req);
  }

  followup(req: FollowupRequest): Observable<AskResponse> {
    return this.http.post<AskResponse>(`${this.base}/followup`, req);
  }

  /** limit 1–50, offset 0–10000 (OpenAPI). No server-side search/status filter exists. */
  history(limit = 50, offset = 0): Observable<HistoryResponse> {
    return this.http.get<HistoryResponse>(`${this.base}/history`, { params: { limit, offset } });
  }

  result(queryId: string): Observable<AskResponse> {
    return this.http.get<AskResponse>(`${this.base}/${encodeURIComponent(queryId)}`);
  }
}
