import { BalancedGridDirective } from '../../shared/balanced-grid.directive';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { FiltersStore } from '../../core/state/filters.store';
import { requestState } from '../../core/utils/request-state';
import { ChartComponent } from '../../shared/chart/chart.component';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** Screen 1 — summary KPIs + admissions and denial charts. APIs: summary, admissions, denials. */
@Component({
  selector: 'app-dashboard-page',
  imports: [BalancedGridDirective, RouterLink, ChartComponent, FilterBarComponent, KpiCardComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly api = inject(DashboardService);
  protected readonly store = inject(FiltersStore);

  protected readonly summary = requestState(this.store.filters, f => this.api.summary(f));
  protected readonly admissions = requestState(
    computed(() => ({ f: this.store.filters(), g: this.store.granularity() })),
    ({ f, g }) => this.api.admissions(f, g),
  );
  protected readonly denials = requestState(this.store.filters, f => this.api.denials(f));

  /** KPI → detail screen (filters are global, so they carry forward). */
  protected readonly kpiLink: Partial<Record<string, string>> = {
    admissions: '/admissions', patients: '/admissions', unique_patients: '/admissions', avg_los: '/admissions', avg_length_of_stay: '/admissions',
    submitted_amount: '/revenue', claim_amount: '/revenue', claims: '/claims', denial_rate: '/claims',
  };
  /** Claim-detail KPIs are shown on Claims & denials; the dashboard keeps the six headline ones. */
  private readonly secondary = new Set(['denial_rate_decided', 'pending_claims', 'pending_over_30d']);
  protected readonly kpis = computed(() => (this.summary().data?.kpis ?? []).filter(k => !this.secondary.has(k.key)));

  protected readonly payersOverTarget = computed(() => {
    const spec = this.denials().data?.charts?.['by_payer'];
    const limit = spec?.options?.highlightAbove;
    return spec && limit !== undefined ? spec.data.filter(r => Number(r['denial_rate']) > limit).length : 0;
  });
}
