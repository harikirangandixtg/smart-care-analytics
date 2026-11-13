import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Kpi } from '../../core/models/api.models';
import { formatValue } from '../format/format';
import { SparklineComponent } from '../sparkline/sparkline.component';

@Component({
  selector: 'app-kpi-card',
  imports: [SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi">
      <span class="kpi-label">{{ kpi().label }}</span>
      <div class="kpi-row">
        <span class="kpi-value" [class.na]="kpi().value === null">{{ display() }}</span>
        @if (kpi().sparkline?.length) {
          <app-sparkline [values]="kpi().sparkline!" [color]="kpi().change?.favourable === false ? '#C8661C' : '#1D5FAD'" />
        }
      </div>
      <div class="kpi-foot">
        @if (kpi().change; as c) {
          <span class="delta" [class.bad]="!c.favourable">{{ c.direction === 'up' ? '▲' : c.direction === 'down' ? '▼' : '■' }} {{ c.label }}</span>
        }
        <span class="muted">{{ kpi().note ?? comparison() }}</span>
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  readonly kpi = input.required<Kpi>();
  readonly comparison = input('');
  protected readonly display = computed(() => formatValue(this.kpi().value, this.kpi().unit));
}
