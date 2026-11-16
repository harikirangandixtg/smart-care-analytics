import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AskResponse } from '../../core/models/api.models';
import { Comparison, Flag, Grounding, Shape, baseline, checkGrounding, denominatorText, flags, fmt, shapeOf } from '../../core/services/insight-checks';
import { FiltersStore } from '../../core/state/filters.store';
import { ChartComponent } from '../../shared/chart/chart.component';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { InsightState, InsightsStore } from './insights.store';

interface Card {
  state: InsightState;
  res?: AskResponse;
  shape: Shape | null;
  grounding: Grounding | null;
  comparisons: Comparison[];
  flags: Flag[];
  top: { label: string; value: string; denom: string | null }[];
  context: { label: string; value: string }[];
}

/**
 * AI Insights. Each card is one POST /api/analytics/ask answer: the Insights Agent's text, plus checks the
 * screen runs on the returned rows only (figure grounding, baseline comparison, statistical flags).
 */
@Component({
  selector: 'app-insights-page',
  imports: [DatePipe, ChartComponent, FilterBarComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insights.page.html',
  styleUrl: './insights.page.scss',
})
export class InsightsPage {
  protected readonly store = inject(InsightsStore);
  private readonly filters = inject(FiltersStore);
  private readonly router = inject(Router);

  protected readonly draft = signal('');
  protected readonly openChart = signal<Record<string, boolean>>({});

  protected readonly stale = computed(() => {
    const r = this.store.ranWith();
    return !!r && r.key !== InsightsStore.key(this.filters.filters());
  });
  protected readonly running = computed(() => this.store.items().some(i => i.status === 'queued' || i.status === 'loading'));
  protected readonly progress = computed(() => {
    const l = this.store.items();
    return { done: l.filter(i => i.status === 'done' || i.status === 'error').length, total: l.length };
  });

  protected readonly cards = computed<Card[]>(() => this.store.items().map(state => {
    const res = state.res;
    if (!res || state.status !== 'done' || res.status !== 'success') return { state, res, shape: null, grounding: null, comparisons: [], flags: [], top: [], context: [] };
    const shape = shapeOf(res);
    const texts = [res.insight ?? '', ...(res.comparisons ?? [])].filter(Boolean);
    const sorted = shape ? (shape.isTime ? [...shape.rows].reverse() : [...shape.rows].sort((a, b) => b.v - a.v)) : [];
    return {
      state, res, shape,
      grounding: checkGrounding(texts, res),
      comparisons: shape ? baseline(shape) : [],
      flags: shape ? flags(shape) : [],
      top: shape ? sorted.slice(0, 4).map(r => ({ label: r.x, value: fmt(r.v, shape.unit), denom: denominatorText(shape, r.row) })) : [],
      context: this.context(res),
    };
  }));

  protected readonly totals = computed(() => {
    const c = this.cards().filter(x => x.res?.status === 'success');
    return {
      findings: c.length,
      flagged: c.reduce((a, x) => a + x.flags.length, 0),
      grounded: c.filter(x => x.grounding && x.grounding.unmatched.length === 0).length,
      notGrounded: c.filter(x => x.grounding && x.grounding.unmatched.length > 0).length,
    };
  });

  protected generate(): void { this.store.runAll(this.filters.filters()); }

  protected addQuestion(): void {
    const q = this.draft().trim();
    if (!q) return;
    this.store.addCustom(q, this.filters.filters());
    this.draft.set('');
  }

  protected toggleChart(id: string): void { this.openChart.update(m => ({ ...m, [id]: !m[id] })); }

  /** Opens the same result in AI Analytics (chart, table, follow-ups). */
  protected open(c: Card): void {
    if (c.res?.query_id) this.router.navigate(['/ai-analytics'], { queryParams: { result: c.res.query_id } });
    else this.router.navigate(['/ai-analytics'], { queryParams: { q: c.state.topic.question } });
  }

  private context(res: AskResponse): { label: string; value: string }[] {
    const out: { label: string; value: string }[] = [];
    const af = res.applied_filters ?? {};
    const p = res.reporting_period;
    if (p?.date_from) out.push({ label: 'Period', value: `${this.date(p.date_from)} – ${this.date(p.date_to)}` });
    for (const [k, v] of Object.entries(af)) if (k !== 'Period') out.push({ label: k, value: v });
    const scoped = ['Hospital', 'Department', 'Payer'].some(k => af[k]);
    if (!scoped) out.push({ label: 'Filters', value: 'All hospitals, departments and payers in your scope' });
    out.push({ label: 'Rows returned', value: String(res.row_count ?? res.table?.rows.length ?? '—') + (res.table?.truncated ? ' (truncated)' : '') });
    return out;
  }
  private date(s?: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : s ?? '';
  }
}
