import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AskResponse } from '../core/models/api.models';
import { AnalyticsService } from '../core/services/analytics.service';
import { FiltersStore } from '../core/state/filters.store';
import { errorMessage } from '../core/utils/request-state';
import { ChartComponent } from '../shared/chart/chart.component';
import { specColumns } from '../shared/chart/spec-to-option';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  tags?: string[];
  tone?: 'normal' | 'warn';
}

const SUGGESTIONS = [
  'How many admissions occurred each month this year?',
  'Which departments have the highest number of admissions?',
  'Show payer-wise claim denial percentage for the last six months',
  'What is the average length of stay by department?',
  'Which claims have been pending for more than 30 days?',
];

const FOLLOWUPS = ['Now show only Cardiology', 'Split by hospital', 'Compare with last year', 'Last three months only'];

@Component({
  selector: 'app-ask-page',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ask.page.html',
  styleUrl: './ask.page.scss',
})
export class AskPage implements OnInit {
  private readonly api = inject(AnalyticsService);
  private readonly store = inject(FiltersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  protected readonly suggestions = SUGGESTIONS;

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly conversationId = signal<string | null>(null);
  protected readonly result = signal<AskResponse | null>(null);
  protected readonly view = signal<'chart' | 'table'>('chart');

  protected readonly chips = computed(() => Object.entries(this.result()?.appliedFilters ?? {}).filter(([k]) => k !== 'Metric'));
  protected readonly facts = computed(() => Object.entries(this.result()?.facts ?? {}));
  protected readonly followups = computed(() => {
    const asked = new Set(this.messages().filter(m => m.role === 'user').map(m => m.text.toLowerCase()));
    return FOLLOWUPS.filter(f => !asked.has(f.toLowerCase()));
  });

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const conv = qp.get('conversation');
    if (conv) {
      this.conversationId.set(conv);
      this.messages.set([{ role: 'assistant', text: `Continuing your earlier question: “${qp.get('q') ?? ''}”. Ask a follow-up.` }]);
    }
  }

  protected send(text = this.draft()): void {
    const question = text.trim();
    if (!question || this.busy()) return;
    this.draft.set('');
    this.busy.set(true);
    this.push({ role: 'user', text: question });

    const conversationId = this.conversationId();
    const req = { question, filters: this.store.filters(), conversationId };
    const call = conversationId ? this.api.followup({ ...req, conversationId }) : this.api.ask(req);

    call.subscribe({
      next: res => {
        this.conversationId.set(res.conversationId);
        if (res.status === 'success' || res.status === 'no_data') {
          this.result.set(res);
          this.view.set('chart');
        }
        this.push({
          role: 'assistant',
          text: res.insight ?? res.message ?? 'Done.',
          tone: res.status === 'success' ? 'normal' : 'warn',
          tags: res.status === 'success' ? Object.values(res.appliedFilters ?? {}).slice(0, 3) : undefined,
        });
        this.busy.set(false);
      },
      error: err => {
        // e.g. expired conversation: start fresh next time
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

  protected exportCsv(): void {
    const spec = this.result()?.chart;
    if (!spec) return;
    const cols = specColumns(spec);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.map(c => esc(c.label)).join(','), ...spec.data.map(r => cols.map(c => esc(r[c.key])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${spec.title.replace(/[^\w]+/g, '-').toLowerCase()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  private push(m: ChatMessage): void {
    this.messages.update(ms => [...ms, m]);
    queueMicrotask(() => {
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
