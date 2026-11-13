import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AskRequest, AskResponse, HistoryDetail, HistoryListResponse, HistoryQuery } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/analytics`;

  ask(req: AskRequest): Observable<AskResponse> {
    return this.http.post<AskResponse>(`${this.base}/ask`, req);
  }

  followup(req: AskRequest & { conversationId: string }): Observable<AskResponse> {
    return this.http.post<AskResponse>(`${this.base}/followup`, req);
  }

  history(q: HistoryQuery = {}): Observable<HistoryListResponse> {
    let params = new HttpParams().set('page', q.page ?? 1).set('size', q.size ?? 10);
    if (q.q) params = params.set('q', q.q);
    if (q.status) params = params.set('status', q.status);
    return this.http.get<HistoryListResponse>(`${this.base}/history`, { params });
  }

  historyDetail(id: string): Observable<HistoryDetail> {
    return this.http.get<HistoryDetail>(`${this.base}/history/${encodeURIComponent(id)}`);
  }

  rerun(id: string): Observable<AskResponse> {
    return this.http.post<AskResponse>(`${this.base}/history/${encodeURIComponent(id)}/rerun`, {});
  }
}
