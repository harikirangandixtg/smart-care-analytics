import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { VisualizationSpec } from '../../core/models/api.models';
import { specColumns } from '../chart/spec-to-option';

@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            @for (c of columns(); track c.key) { <th scope="col" [class.num]="c.numeric">{{ c.label }}</th> }
          </tr>
        </thead>
        <tbody>
          @for (row of spec().data; track $index) {
            <tr>
              @for (c of columns(); track c.key) {
                <td [class.num]="c.numeric">{{ display(row[c.key], c.numeric) }}</td>
              }
            </tr>
          } @empty {
            <tr><td [attr.colspan]="columns().length" class="muted">No rows</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DataTableComponent {
  readonly spec = input.required<VisualizationSpec>();
  protected readonly columns = computed(() => specColumns(this.spec()));
  protected display(v: unknown, numeric: boolean): string {
    if (v === null || v === undefined) return '—';
    return numeric && typeof v === 'number' ? v.toLocaleString('en-IN') : String(v);
  }
}
