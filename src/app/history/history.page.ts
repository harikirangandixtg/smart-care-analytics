import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of } from 'rxjs';
import { AskResponse, HistoryItem, HistoryStatus } from '../core/models/api.models';
import { AnalyticsService } from '../core/services/analytics.service';
import { errorMessage, requestState } from '../core/utils/request-state';
import { ChartComponent } from '../shared/chart/chart.component';

const STATUS_LABEL: Record<HistoryStatus, string> = { answered: 'Answered', no_data: 'No data', clarified: 'Clarified', blocked: 'Blocked' };

@Component({
  selector: 'app-history-page',
  imports: [DatePipe, ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
})
export class HistoryPage {
  private readonly api = inject(AnalyticsService);
  private readonly router = inject(Router);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly search = signal('');
  protected readonly status = signal<HistoryStatus | ''>('');
  protected readonly page = signal(1);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly rerunResult = signal<AskResponse | null>(null);
  protected readonly rerunning = signal(false);
  protected readonly rerunError = signal<string | null>(null);

  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });

  protected readonly list = requestState(
    computed(() => ({ q: this.debouncedSearch(), status: this.status(), page: this.page() })),
    q => this.api.history({ ...q, size: 10 }),
  );

  protected readonly detail = requestState(this.selectedId, id => (id ? this.api.historyDetail(id) : of(null)));

  /** Rows grouped under Today / Yesterday / date headings. */
  protected readonly groups = computed(() => {
    const items = this.list().data?.items ?? [];
    const out: { day: string; items: HistoryItem[] }[] = [];
    for (const it of items) {
      const day = this.dayLabel(it.askedAt);
      const g = out.find(x => x.day === day);
      g ? g.items.push(it) : out.push({ day, items: [it] });
    }
    return out;
  });

  protected readonly totalPages = computed(() => {
    const d = this.list().data;
    return d ? Math.max(1, Math.ceil(d.total / d.size)) : 1;
  });

  /** The result shown in the detail panel: a fresh re-run wins over the stored one. */
  protected readonly shownResult = computed(() => this.rerunResult() ?? this.detail().data?.result ?? null);

  constructor() {
    effect(() => { this.debouncedSearch(); this.status(); this.page.set(1); });
    // select the newest item when nothing is selected yet
    effect(() => {
      const first = this.list().data?.items[0];
      if (first && !this.selectedId()) this.selectedId.set(first.id);
    });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.rerunResult.set(null);
    this.rerunError.set(null);
  }

  protected rerun(id: string): void {
    this.rerunning.set(true);
    this.rerunError.set(null);
    this.api.rerun(id).subscribe({
      next: r => { this.rerunResult.set(r); this.rerunning.set(false); },
      error: e => { this.rerunError.set(errorMessage(e)); this.rerunning.set(false); },
    });
  }

  protected continueConversation(item: HistoryItem): void {
    this.router.navigate(['/ask'], { queryParams: { conversation: item.conversationId, q: item.question } });
  }

  private dayLabel(iso: string): string {
    const d = new Date(iso), today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
