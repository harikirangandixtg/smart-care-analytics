import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Granularity } from '../core/models/api.models';
import { DashboardService } from '../core/services/dashboard.service';
import { FiltersStore } from '../core/state/filters.store';
import { requestState } from '../core/utils/request-state';
import { ChartComponent } from '../shared/chart/chart.component';
import { FilterBarComponent } from '../shared/filter-bar/filter-bar.component';
import { KpiCardComponent } from '../shared/kpi-card/kpi-card.component';

@Component({
  selector: 'app-overview-page',
  imports: [RouterLink, ChartComponent, FilterBarComponent, KpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.page.html',
})
export class OverviewPage {
  private readonly api = inject(DashboardService);
  private readonly store = inject(FiltersStore);

  protected readonly granularity = signal<Granularity>('month');

  protected readonly summary = requestState(this.store.filters, f => this.api.summary(f));
  protected readonly admissions = requestState(
    computed(() => ({ f: this.store.filters(), g: this.granularity() })),
    ({ f, g }) => this.api.admissions(f, g),
  );
  protected readonly claims = requestState(this.store.filters, f => this.api.claims(f));

  protected readonly payersOverTarget = computed(() => {
    const spec = this.claims().data?.denialByPayer;
    const limit = spec?.options?.highlightAbove;
    return spec && limit !== undefined ? spec.data.filter(r => Number(r['denialRate']) > limit).length : 0;
  });
}
