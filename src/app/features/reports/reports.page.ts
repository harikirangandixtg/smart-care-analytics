import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ExportRequest, ReportResponse } from '../../core/models/api.models';
import { MetadataService } from '../../core/services/metadata.service';
import { csvToXlsx } from '../../core/services/excel';
import { ReportService } from '../../core/services/report.service';
import { toAskFilters } from '../../core/services/http-params';
import { FiltersStore } from '../../core/state/filters.store';
import { errorMessage } from '../../core/utils/request-state';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { toSignal } from '@angular/core/rxjs-interop';

export type ReportCategory = 'admissions' | 'revenue' | 'claims' | 'denials' | 'los';

/** Each category maps to one dashboard dataset the export endpoint accepts (ExportRequest.dashboard). */
export const CATEGORIES: { key: ReportCategory; label: string; dashboard: NonNullable<ExportRequest['dashboard']>; note: string }[] = [
  { key: 'admissions', label: 'Admissions', dashboard: 'admissions', note: 'Admissions trend, by department and hospital' },
  { key: 'revenue', label: 'Revenue', dashboard: 'revenue', note: 'Submitted, paid, pending and denied amounts' },
  { key: 'claims', label: 'Claims', dashboard: 'claims', note: 'Status mix, payer outcomes and pending aging' },
  { key: 'denials', label: 'Denials', dashboard: 'denials', note: 'Denial rate by payer, reason and department' },
  { key: 'los', label: 'Length of stay', dashboard: 'departments', note: 'Average LOS and patient days by department' },
];

export type ExportFormat = 'csv' | 'xlsx' | 'json';

export interface ExportJob extends ReportResponse {
  category: ReportCategory;
  /** What the user chose; Excel is requested from the API as CSV and converted in the browser. */
  choice: ExportFormat;
  scope: string;
  downloading?: boolean;
  downloadError?: string | null;
}

/** Exports requested in this browser session; kept while you move between screens. */
@Injectable({ providedIn: 'root' })
export class ExportJobsStore {
  readonly jobs = signal<ExportJob[]>([]);
  upsert(job: ExportJob): void {
    this.jobs.update(list => list.some(j => j.report_id === job.report_id) ? list.map(j => j.report_id === job.report_id ? { ...j, ...job } : j) : [job, ...list]);
  }
  patch(id: string, p: Partial<ExportJob>): void { this.jobs.update(list => list.map(j => j.report_id === id ? { ...j, ...p } : j)); }
  clear(): void { this.jobs.update(list => list.filter(j => j.status === 'queued' || j.status === 'processing')); }
}

/**
 * Reports and export. APIs: POST /api/reports/export, GET /api/reports/{report_id} (status),
 * GET /api/reports/{report_id}?download=true (file). Formats follow the API: CSV and JSON.
 */
@Component({
  selector: 'app-reports-page',
  imports: [DatePipe, DecimalPipe, FilterBarComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  private readonly api = inject(ReportService);
  private readonly store = inject(FiltersStore);
  private readonly meta = inject(MetadataService);
  private readonly destroy = inject(DestroyRef);
  protected readonly jobsStore = inject(ExportJobsStore);

  protected readonly categories = CATEGORIES;
  protected readonly category = signal<ReportCategory>('admissions');
  protected readonly format = signal<ExportFormat>('csv');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly jobs = this.jobsStore.jobs;
  protected readonly selected = computed(() => CATEGORIES.find(c => c.key === this.category())!);

  private readonly hospitals = toSignal(this.meta.hospitals$, { initialValue: [] });
  private readonly departments = toSignal(this.meta.departments$, { initialValue: [] });
  private readonly payers = toSignal(this.meta.payers$, { initialValue: [] });

  /** Plain-language scope shown before export and stored with each job. */
  protected readonly scope = computed(() => {
    const name = (list: { id: string; name: string }[], id: string, all: string) => (id ? list.find(x => x.id === id)?.name ?? id : all);
    return [
      this.store.period().label,
      name(this.hospitals(), this.store.hospitalId(), 'All hospitals'),
      name(this.departments(), this.store.departmentId(), 'All departments'),
      name(this.payers(), this.store.payerId(), 'All payers'),
      `by ${this.store.granularity()}`,
    ].join(' · ');
  });

  protected readonly counts = computed(() => {
    const j = this.jobs();
    return { total: j.length, running: j.filter(x => x.status === 'queued' || x.status === 'processing').length, done: j.filter(x => x.status === 'completed').length, failed: j.filter(x => x.status === 'failed').length };
  });

  protected generate(): void {
    if (this.submitting()) return;
    const cat = this.selected();
    const scope = this.scope();
    const req: ExportRequest = {
      source: 'dashboard', dashboard: cat.dashboard, format: this.format() === 'json' ? 'json' : 'csv',
      filters: toAskFilters(this.store.filters(), true), granularity: this.store.granularity(),
    };
    this.submitting.set(true); this.error.set(null);
    this.api.export(req).subscribe({
      next: first => {
        this.submitting.set(false);
        const job: ExportJob = { ...first, category: cat.key, scope, choice: this.format() };
        this.jobsStore.upsert(job);
        this.track(job);
      },
      error: e => { this.submitting.set(false); this.error.set(errorMessage(e)); },
    });
  }

  private track(job: ExportJob): void {
    const sub = this.api.watch(job).subscribe({
      next: r => this.jobsStore.patch(job.report_id, r),
      error: e => this.jobsStore.patch(job.report_id, { status: 'failed', error: errorMessage(e) }),
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  /** Re-check a job that was still running when you left the screen. */
  protected refresh(job: ExportJob): void { this.track(job); }

  protected download(job: ExportJob): void {
    this.jobsStore.patch(job.report_id, { downloading: true, downloadError: null });
    this.api.download(job).subscribe({
      next: async ({ blob, fileName }) => {
        try {
          if (job.choice === 'xlsx') {
            const xlsx = await csvToXlsx(await blob.text(), this.label(job.category));
            fileName = fileName.replace(/\.(csv|txt)$/i, '') + '.xlsx';
            blob = xlsx;
          }
          this.api.save(blob, fileName);
          this.jobsStore.patch(job.report_id, { downloading: false, file_name: fileName });
        } catch {
          this.jobsStore.patch(job.report_id, { downloading: false, downloadError: 'Could not convert the export to Excel. Try CSV instead.' });
        }
      },
      error: e => this.jobsStore.patch(job.report_id, { downloading: false, downloadError: errorMessage(e) }),
    });
  }

  protected formatLabel(f: ExportFormat): string { return f === 'xlsx' ? 'Excel' : f.toUpperCase(); }
  protected label(key: ReportCategory): string { return CATEGORIES.find(c => c.key === key)?.label ?? key; }
  protected size(bytes?: number): string {
    if (!bytes && bytes !== 0) return '—';
    return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  }
}
