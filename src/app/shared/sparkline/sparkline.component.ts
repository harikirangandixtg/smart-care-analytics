import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block; width: 100%' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" width="100%" [attr.height]="height()" preserveAspectRatio="none" aria-hidden="true">
      <polyline [attr.points]="points()" fill="none" [attr.stroke]="color()" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
  `,
})
export class SparklineComponent {
  readonly values = input.required<number[]>();
  readonly color = input('#1D5FAD');
  readonly width = input(84);
  readonly height = input(28);
  protected readonly points = computed(() => {
    const v = this.values();
    if (v.length < 2) return '';
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    const w = this.width(), h = this.height();
    return v.map((x, i) => `${((w * i) / (v.length - 1)).toFixed(1)},${(h - 3 - ((h - 6) * (x - lo)) / span).toFixed(1)}`).join(' ');
  });
}
