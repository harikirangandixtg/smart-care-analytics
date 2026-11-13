import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HealthResponse, ListEnvelope, MetricDef, NamedEntity } from '../models/api.models';

/** Accepts a bare array, { items: [...] } or { <anything>: [...] } (first array found). */
function unwrap<T>(r: ListEnvelope<T> | Record<string, unknown> | null): T[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === 'object') {
    if (Array.isArray((r as { items?: unknown }).items)) return (r as { items: T[] }).items;
    const firstArray = Object.values(r).find(Array.isArray);
    if (firstArray) return firstArray as T[];
  }
  return [];
}

/** Maps id/name from common backend spellings (hospital_id, hospital_name, code, label …). */
function entity(kind: string) {
  return (x: Record<string, unknown>): NamedEntity => ({
    id: String(x['id'] ?? x[`${kind}_id`] ?? x['code'] ?? ''),
    name: String(x['name'] ?? x[`${kind}_name`] ?? x['label'] ?? x['id'] ?? x[`${kind}_id`] ?? ''),
  });
}

/** /api/metadata/* (filter values) and /api/health*. Lists are cached for the session. */
@Injectable({ providedIn: 'root' })
export class MetadataService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  private list<T>(path: string): Observable<T[]> {
    return this.http.get<ListEnvelope<T>>(`${this.base}/metadata/${path}`).pipe(map(r => unwrap<T>(r)), shareReplay(1));
  }

  readonly hospitals$ = this.list<Record<string, unknown>>('hospitals').pipe(map(xs => xs.map(entity('hospital'))), shareReplay(1));
  readonly departments$ = this.list<Record<string, unknown>>('departments').pipe(map(xs => xs.map(entity('department'))), shareReplay(1));
  readonly payers$ = this.list<Record<string, unknown>>('payers').pipe(map(xs => xs.map(entity('payer'))), shareReplay(1));
  readonly metrics$ = this.list<MetricDef>('metrics');

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health`);
  }

  ready(deep = false): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health/ready`, { params: { deep } });
  }
}
