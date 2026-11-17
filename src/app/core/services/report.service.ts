import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, switchMap, take, takeWhile, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExportRequest, ReportFormat, ReportResponse, ReportStatus } from '../models/api.models';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUS: Record<string, ReportStatus> = {
  queued: 'queued', pending: 'queued', created: 'queued', accepted: 'queued',
  processing: 'processing', running: 'processing', in_progress: 'processing',
  completed: 'completed', complete: 'completed', done: 'completed', success: 'completed', succeeded: 'completed', ready: 'completed', ok: 'completed',
  failed: 'failed', error: 'failed', expired: 'failed',
};

/** The OpenAPI response is an open object: accept id / report_id, file / file_name, message / error, etc. */
export function normalizeReport(raw: any, fallback?: Partial<ReportResponse>): ReportResponse {
  const r = raw ?? {};
  return {
    ...fallback,
    report_id: r.report_id ?? r.id ?? fallback?.report_id ?? '',
    status: STATUS[String(r.status ?? '').toLowerCase()] ?? fallback?.status ?? 'queued',
    format: (String(r.format ?? fallback?.format ?? 'csv').toLowerCase() as ReportFormat),
    download_url: r.download_url ?? r.url ?? fallback?.download_url,
    dashboard: r.dashboard ?? r.request?.dashboard ?? fallback?.dashboard ?? null,
    file_name: r.file_name ?? r.filename ?? r.file ?? fallback?.file_name,
    created_at: r.created_at ?? fallback?.created_at ?? new Date().toISOString(),
    completed_at: r.completed_at ?? r.finished_at ?? fallback?.completed_at,
    expires_at: r.expires_at ?? r.download_expires_at ?? fallback?.expires_at,
    row_count: r.row_count ?? r.rows ?? fallback?.row_count,
    size_bytes: r.size_bytes ?? r.size ?? fallback?.size_bytes,
    error: r.error ?? r.message ?? (r.status === 'failed' ? r.detail : null) ?? null,
  };
}

/** /api/reports/* — request an export, poll its status, download the file. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/reports`;

  export(req: ExportRequest): Observable<ReportResponse> {
    const body = { format: 'csv' as ReportFormat, ...req };
    return this.http.post(`${this.base}/export`, body).pipe(map(r => normalizeReport(r, { format: body.format, dashboard: body.dashboard ?? null })));
  }

  /** GET /api/reports?days=7: this session's files that are still available, newest first. */
  recent(days = 7): Observable<ReportResponse[]> {
    return this.http.get<unknown>(this.base, { params: { days } }).pipe(map(r => {
      const o = (r ?? {}) as Record<string, unknown>;
      const list = (Array.isArray(r) ? r : o['items'] ?? o['reports'] ?? o['data'] ?? []) as unknown[];
      return list.map(x => normalizeReport(x, { report_id: '', status: 'completed', format: 'csv' }))
        .filter(x => x.report_id)
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    }));
  }

  status(reportId: string, known?: ReportResponse): Observable<ReportResponse> {
    return this.http.get(`${this.base}/${encodeURIComponent(reportId)}`).pipe(map(r => normalizeReport(r, known)));
  }

  /** Polls every second (up to 60 tries) and emits each status; completes on completed / failed. */
  watch(first: ReportResponse): Observable<ReportResponse> {
    if (first.status === 'completed' || first.status === 'failed') return new Observable(s => { s.next(first); s.complete(); });
    return timer(0, 1000).pipe(
      take(60),
      switchMap(() => this.status(first.report_id, first)),
      takeWhile(r => r.status !== 'completed' && r.status !== 'failed', true),
    );
  }

  /** The file address: download_url from the API (made absolute), else /api/reports/{id}?download=true. */
  private fileUrl(report: ReportResponse): string {
    const u = report.download_url;
    if (u && /^https?:\/\//i.test(u)) return u;
    if (u) return `${environment.apiBaseUrl}${u.startsWith('/') ? '' : '/'}${u}`;
    return `${this.base}/${encodeURIComponent(report.report_id)}?download=true`;
  }

  /**
   * Fetches the file as a blob (a plain link couldn't send X-Session-Id). Uses the server's file
   * name from Content-Disposition when sent.
   */
  download(report: ReportResponse): Observable<{ blob: Blob; fileName: string }> {
    return this.http.get(this.fileUrl(report), { responseType: 'blob', observe: 'response' }).pipe(
      map((res: HttpResponse<Blob>) => {
        const cd = res.headers.get('content-disposition') ?? '';
        const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
        return { blob: res.body ?? new Blob(), fileName: m ? decodeURIComponent(m[1]) : report.file_name ?? `report-${report.report_id.slice(0, 8)}.${report.format}` };
      }),
    );
  }

  /** Export → poll → download blob (used by AI Analytics' one-click export). */
  exportAndDownload(req: ExportRequest): Observable<{ blob: Blob; report: ReportResponse }> {
    return this.export(req).pipe(
      switchMap(first => this.watch(first)),
      filter(r => r.status === 'completed' || r.status === 'failed'),
      take(1),
      switchMap(r => r.status === 'failed'
        ? throwError(() => new Error(r.error ?? 'The export failed.'))
        : this.download(r).pipe(map(({ blob, fileName }) => ({ blob, report: { ...r, file_name: fileName } })))),
    );
  }

  /** Saves a blob through a temporary link. */
  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
