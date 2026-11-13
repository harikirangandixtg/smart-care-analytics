import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { FiltersStore } from '../../core/state/filters.store';
import { requestState } from '../../core/utils/request-state';
import { ChartComponent } from '../../shared/chart/chart.component';
import { FilterBarComponent } from '../../shared/filter-bar/filter-bar.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { QuestionListComponent } from '../../shared/question-list/question-list.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';

/** Screen 3 — admission patterns. APIs: GET /api/dashboard/admissions, GET /api/dashboard/trends?group_by=department. */
@Component({
  selector: 'app-admissions-page',
  imports: [DecimalPipe, ChartComponent, FilterBarComponent, PageHeaderComponent, QuestionListComponent, StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admissions.page.html',
})
export class AdmissionsPage {
  private readonly api = inject(DashboardService);
  private readonly store = inject(FiltersStore);
  private readonly query = computed(() => ({ f: this.store.filters(), g: this.store.granularity() }));

  protected readonly admissions = requestState(this.query, ({ f, g }) => this.api.admissions(f, g, 8));
  protected readonly byDeptTrend = requestState(this.query, ({ f, g }) => this.api.trends(f, 'admissions', 'department', g));

  protected readonly questions = [
    { question: 'Show monthly admissions', shownAs: 'Line chart' },
    { question: 'Admissions by department', shownAs: 'Bar chart' },
    { question: 'Compare hospitals', shownAs: 'Bar chart' },
    { question: 'Average LOS by department', shownAs: 'Horizontal bar chart' },
    { question: 'Admissions by month and department', shownAs: 'Multi-series line chart' },
  ];
}
