import { BalancedGridDirective } from '../../shared/balanced-grid.directive';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { FiltersStore } from '../../core/state/filters.store';
import { requestState } from '../../core/utils/request-state';
import { ChartComponent } from '../../shared/chart/chart.component';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { usd, pct } from '../../shared/format/format';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { QuestionListComponent } from '../../shared/question-list/question-list.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';

/**
 * Screen 5 — claim status, denial patterns and aged pending claims.
 * APIs: GET /api/dashboard/claims (KPIs + charts; and again with claim_status=Pending, limit/offset for the list),
 *       GET /api/dashboard/denials, GET /api/dashboard/trends?metric=denial_rate.
 */
@Component({
  selector: 'app-claims-page',
  imports: [BalancedGridDirective, DecimalPipe, ChartComponent, FilterBarComponent, PageHeaderComponent, QuestionListComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './claims.page.html',
})
export class ClaimsPage {
  private readonly api = inject(DashboardService);
  private readonly store = inject(FiltersStore);
  protected readonly usd = usd;
  protected readonly pct = pct;

  protected readonly pageSize = 8;
  protected readonly offset = signal(0);

  protected readonly claims = requestState(this.store.filters, f => this.api.claims(f, 1, 0));
  protected readonly denials = requestState(this.store.filters, f => this.api.denials(f, 8));
  protected readonly trend = requestState(this.store.filters, f => this.api.trends(f, 'denial_rate'));
  protected readonly pending = requestState(
    computed(() => ({ f: this.store.filters(), offset: this.offset() })),
    ({ f, offset }) => this.api.claims(f, this.pageSize, offset),
  );

  /** /trends?metric=denial_rate, or the denials endpoint's own trend when /trends returns nothing. */
  protected readonly denialTrend = computed(() => {
    const t = this.trend().data?.chart;
    return t?.data?.length ? t : this.denials().data?.charts?.['monthly_rate'] ?? t ?? null;
  });

  protected readonly page = computed(() => Math.floor(this.offset() / this.pageSize) + 1);
  protected readonly pages = computed(() => Math.max(1, Math.ceil((this.pending().data?.total ?? 0) / this.pageSize)));

  protected readonly questions = [
    { question: 'Compare denial rates across departments', shownAs: 'Horizontal bar chart' },
    { question: 'Show pending claims older than 30 days', shownAs: 'Table + aging bars' },
    { question: 'What are the common denial reasons?', shownAs: 'Bar chart + reason table' },
    { question: 'Which payer has the highest denial rate?', shownAs: 'Table / bar chart' },
  ];

  constructor() {
    effect(() => { this.store.filters(); this.offset.set(0); });
  }
}
