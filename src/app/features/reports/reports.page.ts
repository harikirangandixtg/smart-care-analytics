import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ExportRequest, ReportFormat, ReportResponse } from '../../core/models/api.models';
import { MetadataService } from '../../core/services/metadata.service';
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

export type ExportFormat = ReportFormat;
export const AVAILABLE_DAYS = 7;

export interface ExportJob extends ReportResponse {
  category?: ReportCategory | null;
  scope?: string;
  downloading?: boolean;
  downloadError?: string | null;
}

interface Label { category: ReportCategory; scope: string; at: number }
const LABELS_KEY = 'sca-export-labels';

/**
 * Your exports. The list comes from GET /api/reports?days=7 (files for this browser's session ID that are
 * still available). New requests show here straight away while they run. The report type and scope you
 * chose are remembered on this browser for 7 days, because the list endpoint doesn't return them.
 */
@Injectable({ providedIn: 'root' })
export class ExportsStore {
  private readonly api = inject(ReportService);
  readonly items = signal<ExportJob[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private labels: Record<string, Label> = readLabels();

  load(): void {
    this.loading.set(true); this.error.set(null);
    this.api.recent(AVAILABLE_DAYS).subscribe({
      next: list => {
        const ids = new Set(list.map(r => r.report_id));
        const pending = this.items().filter(j => !ids.has(j.report_id) && (j.status === 'queued' || j.status === 'processing' || j.status === 'failed'));
        const prev = new Map(this.items().map(j => [j.report_id, j]));
        this.items.set([...pending, ...list.map(r => ({ ...this.decorate(r), downloading: prev.get(r.report_id)?.downloading, downloadError: prev.get(r.report_id)?.downloadError }))]);
        this.loading.set(false);
      },
      error: e => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }

  add(job: ReportResponse, category: ReportCategory, scope: string): ExportJob {
    this.labels[job.report_id] = { category, scope, at: Date.now() };
    saveLabels(this.labels);
    const j: ExportJob = { ...job, category, scope };
    this.items.update(list => [j, ...list.filter(x => x.report_id !== j.report_id)]);
    return j;
  }

  patch(id: string, p: Partial<ExportJob>): void { this.items.update(list => list.map(j => (j.report_id === id ? { ...j, ...p } : j))); }

  private decorate(r: ReportResponse): ExportJob {
    const l = this.labels[r.report_id];
    const category = l?.category ?? CATEGORIES.find(c => c.dashboard === r.dashboard)?.key ?? null;
    return { ...r, category, scope: l?.scope };
  }
}

function readLabels(): Record<string, Label> {
  try {
    const all = JSON.parse(localStorage.getItem(LABELS_KEY) ?? '{}') as Record<string, Label>;
    const cutoff = Date.now() - AVAILABLE_DAYS * 864e5;
    return Object.fromEntries(Object.entries(all).filter(([, v]) => v && v.at >= cutoff));
  } catch { return {}; }
}
function saveLabels(l: Record<string, Label>): void {
  try { localStorage.setItem(LABELS_KEY, JSON.stringify(l)); } catch { /* storage unavailable: labels just won't survive a reload */ }
}

/**
 * Reports and export. APIs: POST /api/reports/export, GET /api/reports/{report_id} (status),
 * GET /api/reports?days=7 (your files), download_url (file, fetched with X-Session-Id). Formats: CSV, Excel, JSON.
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
  protected readonly exports = inject(ExportsStore);

  protected readonly categories = CATEGORIES;
  protected readonly category = signal<ReportCategory>('admissions');
  protected readonly format = signal<ExportFormat>('csv');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly jobs = this.exports.items;
  protected readonly days = AVAILABLE_DAYS;
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

  constructor() { this.exports.load(); }

  protected generate(): void {
    if (this.submitting()) return;
    const cat = this.selected();
    const scope = this.scope();
    const req: ExportRequest = {
      source: 'dashboard', dashboard: cat.dashboard, format: this.format(),
      filters: toAskFilters(this.store.filters(), true), granularity: this.store.granularity(),
    };
    this.submitting.set(true); this.error.set(null);
    this.api.export(req).subscribe({
      next: first => {
        this.submitting.set(false);
        const job = this.exports.add(first, cat.key, scope);
        this.track(job);
      },
      error: e => { this.submitting.set(false); this.error.set(errorMessage(e)); },
    });
  }

  /** Follows a queued export until it finishes, then reloads the list (the server's record is the one kept). */
  private track(job: ExportJob): void {
    const sub = this.api.watch(job).subscribe({
      next: r => this.exports.patch(job.report_id, r),
      error: e => this.exports.patch(job.report_id, { status: 'failed', error: errorMessage(e) }),
      complete: () => { if (this.jobs().find(j => j.report_id === job.report_id)?.status === 'completed') this.exports.load(); },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  protected refresh(job: ExportJob): void { this.track(job); }

  protected download(job: ExportJob): void {
    this.exports.patch(job.report_id, { downloading: true, downloadError: null });
    this.api.download(job).subscribe({
      next: ({ blob, fileName }) => {
        this.api.save(blob, fileName);
        this.exports.patch(job.report_id, { downloading: false, file_name: fileName });
      },
      error: e => this.exports.patch(job.report_id, {
        downloading: false,
        downloadError: e?.status === 404 || e?.status === 410 ? 'This file is no longer available.' : errorMessage(e),
      }),
    });
  }

  /** "6 days left" / "5 hours left" / "Expired". */
  protected remaining(expires?: string): string {
    if (!expires) return '';
    const ms = new Date(expires).getTime() - Date.now();
    if (!Number.isFinite(ms)) return '';
    if (ms <= 0) return 'Expired';
    const d = Math.ceil(ms / 864e5), h = Math.floor(ms / 36e5);
    return ms >= 864e5 ? `${d} day${d > 1 ? 's' : ''} left` : h >= 1 ? `${h} hour${h > 1 ? 's' : ''} left` : 'Less than an hour left';
  }
  protected expired(expires?: string): boolean { return !!expires && new Date(expires).getTime() <= Date.now(); }

  protected formatLabel(f: ReportFormat): string { return f === 'xlsx' ? 'Excel' : f.toUpperCase(); }
  protected label(j: ExportJob): string { return CATEGORIES.find(c => c.key === j.category)?.label ?? (j.dashboard ? j.dashboard.replace(/^./, c => c.toUpperCase()) : 'Report'); }
  protected size(bytes?: number): string {
    if (!bytes && bytes !== 0) return '—';
    return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  }
}
