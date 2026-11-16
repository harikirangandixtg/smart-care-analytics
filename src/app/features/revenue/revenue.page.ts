import { BalancedGridDirective } from '../../shared/balanced-grid.directive';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DimensionResponse, VisualizationSpec } from '../../core/models/api.models';
import { DashboardService } from '../../core/services/dashboard.service';
import { FiltersStore } from '../../core/state/filters.store';
import { requestState } from '../../core/utils/request-state';
import { ChartComponent } from '../../shared/chart/chart.component';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { inr, pct } from '../../shared/format/format';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { QuestionListComponent } from '../../shared/question-list/question-list.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';

const cr = (v: number | null) => (v === null ? null : Math.round((v / 1e7) * 100) / 100);

/** Builds a submitted-vs-paid chart from aggregate rows (mapping only; no measures are calculated here). */
function submittedVsPaid(res: DimensionResponse | undefined, title: string, key: string, horizontal: boolean): VisualizationSpec | null {
  if (!res) return null;
  const hasPaid = res.rows.some(r => r.paid_amount !== null);
  return {
    chartType: 'bar', title, xKey: key,
    series: hasPaid ? [{ dataKey: 'Submitted', label: 'Submitted' }, { dataKey: 'Paid', label: 'Paid' }] : [{ dataKey: 'Submitted', label: 'Submitted' }],
    data: res.rows.map(r => ({ [key]: r.name, Submitted: cr(r.submitted_amount), Paid: cr(r.paid_amount) })),
    options: { orientation: horizontal ? 'horizontal' : 'vertical', unit: ' Cr' },
  };
}

/** Screen 4 — claim amounts by outcome. APIs: GET /api/dashboard/revenue, /hospitals, /departments. */
@Component({
  selector: 'app-revenue-page',
  imports: [BalancedGridDirective, ChartComponent, FilterBarComponent, PageHeaderComponent, QuestionListComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revenue.page.html',
})
export class RevenuePage {
  private readonly api = inject(DashboardService);
  private readonly store = inject(FiltersStore);
  protected readonly inr = inr;
  protected readonly pct = pct;

  protected readonly revenue = requestState(computed(() => ({ f: this.store.filters(), g: this.store.granularity() })), ({ f, g }) => this.api.revenue(f, g));
  protected readonly hospitals = requestState(this.store.filters, f => this.api.hospitals(f));
  protected readonly departments = requestState(this.store.filters, f => this.api.departments(f));

  protected readonly hospitalChart = computed(() => this.revenue().data?.charts?.['by_hospital'] ?? submittedVsPaid(this.hospitals().data, 'Submitted vs paid by hospital (₹ Cr)', 'hospital', true));
  protected readonly departmentChart = computed(() => this.revenue().data?.charts?.['by_department'] ?? submittedVsPaid(this.departments().data, 'Submitted vs paid by department (₹ Cr)', 'department', false));

  protected readonly questions = [
    { question: 'Show pending claim amounts by payer', shownAs: 'Horizontal bar chart' },
    { question: 'Compare revenue between hospitals', shownAs: 'Grouped bar chart' },
    { question: 'Which department generates the highest claim amount?', shownAs: 'Grouped bar chart' },
    { question: 'Show monthly revenue for 2026', shownAs: 'Stacked bar chart' },
  ];
}
