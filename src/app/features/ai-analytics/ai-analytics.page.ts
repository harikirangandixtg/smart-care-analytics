import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AskResponse } from '../../core/models/api.models';
import { AnalyticsService } from '../../core/services/analytics.service';
import { toAskFilters } from '../../core/services/http-params';
import { ReportService } from '../../core/services/report.service';
import { FiltersStore } from '../../core/state/filters.store';
import { errorMessage } from '../../core/utils/request-state';
import { ChartComponent } from '../../shared/chart/chart.component';

interface ChatMessage { role: 'user' | 'assistant'; text: string; tags?: string[]; tone?: 'normal' | 'warn' }

const SUGGESTIONS = [
  'Show monthly admissions for 2026',
  'Which department has the highest number of admissions?',
  'Which payer has the highest claim denial rate?',
  'Which department has the longest average length of stay?',
  'Show claims pending for more than 30 days',
];
const FOLLOWUPS = ['Now show only Cardiology', 'Split by hospital', 'Compare with last year', 'Last three months only'];

/** Screen 2 — APIs: POST /api/analytics/ask, POST /api/analytics/followup, POST /api/reports/export (+ GET /api/reports/{id}). */
@Component({
  selector: 'app-ai-analytics-page',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-analytics.page.html',
  styleUrl: './ai-analytics.page.scss',
})
export class AiAnalyticsPage implements OnInit {
  private readonly api = inject(AnalyticsService);
  private readonly reports = inject(ReportService);
  private readonly store = inject(FiltersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  protected readonly suggestions = SUGGESTIONS;
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);
  protected readonly conversationId = signal<string | null>(null);
  protected readonly result = signal<AskResponse | null>(null);
  protected readonly view = signal<'chart' | 'table'>('chart');

  protected readonly chips = computed(() => Object.entries(this.result()?.applied_filters ?? {}).filter(([k]) => k !== 'Metric'));
  protected readonly facts = computed(() => this.result()?.supporting_metrics ?? []);
  protected readonly followups = computed(() => {
    const asked = new Set(this.messages().filter(m => m.role === 'user').map(m => m.text.toLowerCase()));
    return FOLLOWUPS.filter(f => !asked.has(f.toLowerCase()));
  });

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const conv = qp.get('conversation');
    const q = qp.get('q');
    const resultId = qp.get('result');
    if (resultId) {
      // Opened from AI Insights: show that exact result (GET /api/analytics/{query_id}) and continue its conversation.
      this.busy.set(true);
      this.api.result(resultId).subscribe({
        next: res => {
          this.conversationId.set(res.conversation_id ?? null);
          this.push({ role: 'user', text: res.question || q || 'Insight' });
          if (res.status === 'success' || res.status === 'no_data') { this.result.set(res); this.view.set('chart'); }
          this.push({ role: 'assistant', text: res.insight ?? res.message ?? 'Done.', tone: res.status === 'success' ? 'normal' : 'warn', tags: Object.values(res.applied_filters ?? {}).slice(0, 3) });
          this.busy.set(false);
        },
        error: err => { this.push({ role: 'assistant', text: errorMessage(err), tone: 'warn' }); this.busy.set(false); },
      });
    } else if (conv) {
      this.conversationId.set(conv);
      this.messages.set([{ role: 'assistant', text: `Continuing your earlier question${q ? `: “${q}”` : ''}. Ask a follow-up.` }]);
    } else if (q) {
      queueMicrotask(() => this.send(q));
    }
    if (conv || q || resultId) this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected send(text = this.draft()): void {
    const question = text.trim().slice(0, 500);
    if (!question || this.busy()) return;
    this.draft.set('');
    this.busy.set(true);
    this.exportError.set(null);
    this.push({ role: 'user', text: question });

    const conversationId = this.conversationId();
    // Follow-ups carry only conversation_id + question (OpenAPI FollowupRequest); filters live in the conversation.
    const call = conversationId
      ? this.api.followup({ conversation_id: conversationId, question })
      : this.api.ask({ question, filters: toAskFilters(this.store.filters()), conversation_id: null });

    call.subscribe({
      next: res => {
        this.conversationId.set(res.conversation_id);
        if (res.status === 'success' || res.status === 'no_data') { this.result.set(res); this.view.set('chart'); }
        this.push({
          role: 'assistant',
          text: res.insight ?? res.message ?? 'Done.',
          tone: res.status === 'success' ? 'normal' : 'warn',
          tags: res.status === 'success' ? Object.values(res.applied_filters ?? {}).slice(0, 3) : undefined,
        });
        this.busy.set(false);
      },
      error: err => {
        if (conversationId) this.conversationId.set(null);
        this.push({ role: 'assistant', text: errorMessage(err), tone: 'warn' });
        this.busy.set(false);
      },
    });
  }

  protected newConversation(): void {
    this.conversationId.set(null);
    this.messages.set([]);
    this.result.set(null);
  }

  /** Server-side export of the displayed aggregate result: POST /api/reports/export → poll → download. */
  protected exportCsv(): void {
    const r = this.result();
    if (!r || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    this.reports.exportAndDownload({ source: 'analytics', query_id: r.query_id, format: 'csv' }).subscribe({
      next: ({ blob, report }) => { this.reports.save(blob, report.file_name ?? 'analytics-result.csv'); this.exporting.set(false); },
      error: e => { this.exportError.set(errorMessage(e)); this.exporting.set(false); },
    });
  }

  protected isNum(v: unknown): boolean { return typeof v === 'number'; }
  protected cell(v: unknown, col = ''): string {
    if (v === null || v === undefined) return '—';
    if (typeof v !== 'number') return String(v);
    const n = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return /(rate|percent|percentage|pct|share)$/i.test(col) ? `${n}%` : n;
  }
  protected colLabel(c: string): string { return c.replace(/_/g, ' ').replace(/^./, x => x.toUpperCase()); }

  private push(m: ChatMessage): void {
    this.messages.update(ms => [...ms, m]);
    queueMicrotask(() => { const el = this.thread()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; });
  }
}
