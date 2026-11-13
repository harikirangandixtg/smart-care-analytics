import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Kpi } from '../../core/models/api.models';
import { SparklineComponent } from '../sparkline/sparkline.component';

@Component({
  selector: 'app-kpi-card',
  imports: [SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi">
      <span class="kpi-label">{{ kpi().label }}</span>
      <div class="kpi-row">
        <span class="kpi-value">{{ kpi().display }}</span>
        <app-sparkline [values]="kpi().sparkline" [color]="kpi().change.favourable ? '#1D5FAD' : '#C8661C'" />
      </div>
      <div class="kpi-foot">
        <span class="delta" [class.bad]="!kpi().change.favourable">
          {{ kpi().change.direction === 'up' ? '▲' : '▼' }} {{ kpi().change.label }}
        </span>
        <span class="muted">{{ comparison() }}</span>
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  readonly kpi = input.required<Kpi>();
  readonly comparison = input('');
}
