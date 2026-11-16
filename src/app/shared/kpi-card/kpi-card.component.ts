import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Kpi } from '../../core/models/api.models';
import { formatValue } from '../format/format';
import { SparklineComponent } from '../sparkline/sparkline.component';

/**
 * Headline KPI. Fixed rows (label · value · trend · footer) so every card in a row lines up,
 * whatever the API sends: long labels clamp to two lines, the value shrinks with the card width,
 * a missing trend or change badge keeps its space, and the footer always sits at the bottom.
 */
@Component({
  selector: 'app-kpi-card',
  imports: [SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi" [title]="tooltip()">
      <span class="kpi-label">{{ kpi().label }}</span>
      <span class="kpi-value" [class.na]="kpi().value === null || kpi().value === undefined">{{ display() }}</span>
      <div class="kpi-trend">
        @if (spark().length > 1) {
          <app-sparkline [values]="spark()" [color]="kpi().change?.favourable === false ? '#C8661C' : '#1D5FAD'" />
        }
      </div>
      <div class="kpi-foot">
        <div class="kpi-foot-row">
          @if (kpi().change; as c) {
            <span class="delta" [class.bad]="c.favourable === false" [class.flat]="c.direction === 'flat'">{{ c.direction === 'up' ? '▲' : c.direction === 'down' ? '▼' : '■' }} {{ c.label }}</span>
          }
          @if (kpi().note) { <span class="kpi-note">{{ kpi().note }}</span> }
        </div>
        @if (kpi().change && comparison()) { <span class="kpi-cmp">{{ comparison() }}</span> }
        @else if (!kpi().change && !kpi().note && comparison()) { <span class="kpi-cmp">{{ comparison() }}</span> }
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  readonly kpi = input.required<Kpi>();
  readonly comparison = input('');
  protected readonly display = computed(() => formatValue(this.kpi().value, this.kpi().unit));
  protected readonly spark = computed(() => (this.kpi().sparkline ?? []).filter(v => typeof v === 'number' && Number.isFinite(v)));
  /** Full text on hover, in case anything was clamped. */
  protected readonly tooltip = computed(() => {
    const k = this.kpi();
    return [`${k.label}: ${this.display()}`, k.change ? `${k.change.label} ${this.comparison()}`.trim() : '', k.note ?? ''].filter(Boolean).join('\n');
  });
}
