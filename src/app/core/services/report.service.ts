import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, switchMap, take, takeWhile, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExportRequest, ReportResponse } from '../models/api.models';

/** /api/reports/* — request an export, poll until completed, then download the file. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/reports`;

  export(req: ExportRequest): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.base}/export`, { format: 'csv', ...req });
  }

  status(reportId: string): Observable<ReportResponse> {
    return this.http.get<ReportResponse>(`${this.base}/${encodeURIComponent(reportId)}`);
  }

  file(reportId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${encodeURIComponent(reportId)}`, { params: { download: true }, responseType: 'blob' });
  }

  /** Export → poll status (1 s, up to 30 tries) → download blob. */
  exportAndDownload(req: ExportRequest): Observable<{ blob: Blob; report: ReportResponse }> {
    return this.export(req).pipe(
      switchMap(first => first.status === 'completed' ? [first] : timer(0, 1000).pipe(
        switchMap(() => this.status(first.report_id)),
        takeWhile(r => r.status !== 'completed' && r.status !== 'failed', true),
        filter(r => r.status === 'completed' || r.status === 'failed'),
        take(1),
      )),
      switchMap(r => r.status === 'failed'
        ? throwError(() => new Error(r.error ?? 'The export failed.'))
        : this.file(r.report_id).pipe(switchMap(blob => [{ blob, report: r }]))),
    );
  }

  /** Saves a blob through a temporary link. */
  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    URL.revokeObjectURL(url);
  }
}
