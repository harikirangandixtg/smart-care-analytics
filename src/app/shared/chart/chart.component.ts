import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { VisualizationSpec } from '../../core/models/api.models';
import { DataTableComponent } from '../data-table/data-table.component';
import { toEchartsOption } from './spec-to-option';

/** Renders any VisualizationSpec: ECharts for charts, a table for chartType 'table' or when view='table'. */
@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view() === 'table' || spec().chartType === 'table') {
      <app-data-table [spec]="spec()" />
    } @else {
      <div echarts [options]="option()" [autoResize]="true" class="chart"
           [style.height.px]="height()" role="img" [attr.aria-label]="spec().title"></div>
    }
  `,
  styles: `.chart { width: 100%; }`,
})
export class ChartComponent {
  readonly spec = input.required<VisualizationSpec>();
  readonly height = input(300);
  readonly view = input<'chart' | 'table'>('chart');
  protected readonly option = computed(() => toEchartsOption(this.spec()));
}
