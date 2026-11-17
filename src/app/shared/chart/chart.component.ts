import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { VisualizationSpec } from '../../core/models/api.models';
import { DataTableComponent } from '../data-table/data-table.component';
import { specProblem, toEchartsOption } from './spec-to-option';

/**
 * Renders a VisualizationSpec with ECharts. Validates chartType and field names first (frontend spec §14):
 * empty data → empty message; unsupported type or missing fields → table fallback with a note.
 */
@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!spec() || !spec()!.data.length) {
      <div class="empty-state" [style.min-height.px]="height() * 0.6">{{ problem() }}</div>
    } @else if (view() === 'table' || spec()!.chartType === 'table' || problem()) {
      @if (problem() && view() !== 'table') { <p class="muted small">{{ problem() }}</p> }
      <app-data-table [spec]="spec()!" />
    } @else {
      <div echarts [options]="option()" [autoResize]="true" class="chart" [style.height.px]="effectiveHeight()" role="img" [attr.aria-label]="spec()!.title"></div>
    }
  `,
  styles: `.chart { width: 100%; }`,
})
export class ChartComponent {
  readonly spec = input<VisualizationSpec | null | undefined>();
  readonly height = input(300);
  /** Charts with a legend (several series, or pie slices) need room for it: never shorter than 260px. */
  protected readonly effectiveHeight = computed(() => {
    const s = this.spec();
    if (!s) return this.height();
    const legend = s.chartType === 'pie' || !!s.seriesKey || (s.series?.length ?? 0) > 1;
    return legend ? Math.max(this.height(), 260) : this.height();
  });
  readonly view = input<'chart' | 'table'>('chart');
  protected readonly problem = computed(() => specProblem(this.spec()));
  protected readonly option = computed(() => (this.spec() ? toEchartsOption(this.spec()!) : {}));
}
