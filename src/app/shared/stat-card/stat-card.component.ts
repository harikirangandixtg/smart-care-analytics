import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Compact total with a coloured accent bar (Admissions / Revenue / Claims screens). */
@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat-card">
      <span class="stat-accent" [style.background]="accent()"></span>
      <div class="stat-body">
        <span class="stat-label">{{ label() }}</span>
        <span class="stat-value">{{ value() }}</span>
        @if (note()) { <span class="stat-note">{{ note() }}</span> }
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input('');
  readonly accent = input('#1D5FAD');
}
