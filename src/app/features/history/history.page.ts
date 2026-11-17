import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { of } from 'rxjs';
import { HistoryItem } from '../../core/models/api.models';
import { AnalyticsService } from '../../core/services/analytics.service';
import { FiltersStore } from '../../core/state/filters.store';
import { requestState } from '../../core/utils/request-state';
import { ChartComponent } from '../../shared/chart/chart.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

type Bucket = 'answered' | 'clarified' | 'no_data' | 'blocked';
const BUCKET: Record<string, Bucket> = { success: 'answered', no_data: 'no_data', clarification_needed: 'clarified', blocked: 'blocked', error: 'blocked' };
const LABEL: Record<Bucket, string> = { answered: 'Answered', clarified: 'Clarified', no_data: 'No data', blocked: 'Blocked' };
const PAGE = 10;
const FETCH = 50; // OpenAPI max for /history

/**
 * Query history. APIs: GET /api/analytics/history?limit=50&offset=0, GET /api/analytics/{query_id},
 * POST /api/analytics/ask (re-run). The API has no search/status parameters, so those filter the loaded page.
 */
@Component({
  selector: 'app-history-page',
  imports: [DatePipe, KeyValuePipe, ChartComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
})
export class HistoryPage {
  private readonly api = inject(AnalyticsService);
  private readonly store = inject(FiltersStore);

  protected readonly label = LABEL;
  /** keyvalue pipe comparator that keeps the API's order. */
  protected readonly keep = () => 0;
  /** Show the Result column only when the API reports rows or timing for at least one question on this page. */
  protected readonly hasResult = computed(() => (this.list().data?.items ?? []).some(i => i.row_count != null || i.execution_time_ms != null));
  protected readonly bucket = (s: string): Bucket => BUCKET[s] ?? 'blocked';
  /** "10 rows · 9.8 s", leaving out whatever the API didn't report. */
  protected resultText(it: { row_count?: number | null; execution_time_ms?: number | null }): string {
    const parts: string[] = [];
    if (it.row_count !== null && it.row_count !== undefined) parts.push(`${it.row_count} ${it.row_count === 1 ? 'row' : 'rows'}`);
    const ms = it.execution_time_ms;
    if (ms !== null && ms !== undefined) parts.push(ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
    return parts.join(' · ') || '—';
  }
  protected readonly search = signal('');
  protected readonly status = signal<Bucket | ''>('');
  protected readonly page = signal(1);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly list = requestState(this.store.refreshTick, () => this.api.history(FETCH, 0));
  protected readonly detail = requestState(this.selectedId, id => (id ? this.api.result(id) : of(null)));

  private readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase(), st = this.status();
    return (this.list().data?.items ?? []).filter(i => (!term || i.question.toLowerCase().includes(term)) && (!st || this.bucket(i.status) === st));
  });
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * PAGE, this.page() * PAGE));
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE)));
  protected readonly shownCount = computed(() => this.filtered().length);

  /** Counts over the loaded history (most recent 50). */
  protected readonly summary = computed(() => {
    const items = this.list().data?.items ?? [];
    const n = (b: Bucket) => items.filter(i => this.bucket(i.status) === b).length;
    return { asked: items.length, total: this.list().data?.total ?? 0, answered: n('answered'), clarified: n('clarified') + n('no_data'), blocked: n('blocked') };
  });

  protected readonly groups = computed(() => {
    const out: { day: string; items: HistoryItem[] }[] = [];
    for (const it of this.visible()) {
      const day = this.dayLabel(it.created_at);
      const g = out.find(x => x.day === day);
      g ? g.items.push(it) : out.push({ day, items: [it] });
    }
    return out;
  });

  protected readonly shown = computed(() => this.detail().data ?? null);
  protected readonly selectedItem = computed(() => this.list().data?.items?.find(i => i.query_id === this.selectedId()) ?? null);
  protected readonly parentQuestion = computed(() => {
    const p = this.selectedItem()?.parent_query_id;
    return p ? this.list().data?.items?.find(i => i.query_id === p)?.question ?? null : null;
  });

  constructor() {
    effect(() => { this.search(); this.status(); this.page.set(1); });
    effect(() => { const first = this.list().data?.items?.[0]; if (first && !this.selectedId()) this.selectedId.set(first.query_id); });
  }

  protected select(id: string): void { this.selectedId.set(id); }

  private dayLabel(iso: string): string {
    const d = new Date(iso), t = new Date();
    const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(t) - start(d)) / 86_400_000);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
