import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HealthResponse, ListEnvelope, MetricDef, NamedEntity } from '../models/api.models';

const unwrap = <T>(r: ListEnvelope<T>): T[] => (Array.isArray(r) ? r : r?.items ?? []);

/** /api/metadata/* (filter values) and /api/health*. Lists are cached for the session. */
@Injectable({ providedIn: 'root' })
export class MetadataService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  private list<T>(path: string): Observable<T[]> {
    return this.http.get<ListEnvelope<T>>(`${this.base}/metadata/${path}`).pipe(map(unwrap), shareReplay(1));
  }

  readonly hospitals$ = this.list<NamedEntity>('hospitals');
  readonly departments$ = this.list<NamedEntity>('departments');
  readonly payers$ = this.list<NamedEntity>('payers');
  readonly metrics$ = this.list<MetricDef>('metrics');

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health`);
  }

  ready(deep = false): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health/ready`, { params: { deep } });
  }
}
