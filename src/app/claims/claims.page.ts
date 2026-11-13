import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DashboardService } from '../core/services/dashboard.service';
import { MetaService } from '../core/services/meta.service';
import { FiltersStore } from '../core/state/filters.store';
import { requestState } from '../core/utils/request-state';
import { ChartComponent } from '../shared/chart/chart.component';
import { FilterBarComponent } from '../shared/filter-bar/filter-bar.component';

@Component({
  selector: 'app-claims-page',
  imports: [AsyncPipe, DecimalPipe, ChartComponent, FilterBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './claims.page.html',
})
export class ClaimsPage {
  private readonly api = inject(DashboardService);
  private readonly store = inject(FiltersStore);
  protected readonly meta = inject(MetaService);

  protected readonly payer = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 6;

  private readonly query = computed(() => ({ f: this.store.filters(), payer: this.payer() || undefined }));

  protected readonly claims = requestState(this.query, ({ f, payer }) => this.api.claims(f, payer));
  protected readonly admissions = requestState(this.store.filters, f => this.api.admissions(f));
  protected readonly pending = requestState(
    computed(() => ({ ...this.query(), page: this.page() })),
    ({ f, payer, page }) => this.api.pendingClaims(f, { minDays: 30, payer, page, size: this.pageSize }),
  );

  protected readonly totalPages = computed(() => {
    const p = this.pending().data;
    return p ? Math.max(1, Math.ceil(p.total / p.size)) : 1;
  });

  constructor() {
    // back to page 1 whenever filters change
    effect(() => { this.query(); this.page.set(1); });
  }
}
