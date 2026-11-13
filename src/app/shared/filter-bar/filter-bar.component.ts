import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MetaService } from '../../core/services/meta.service';
import { FiltersStore, PERIOD_PRESETS } from '../../core/state/filters.store';

/** Hospital + reporting period selects, bound to the shared FiltersStore. Extra controls project in. */
@Component({
  selector: 'app-filter-bar',
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters">
      <label class="field">Hospital
        <select [value]="store.hospitalId()" (change)="store.hospitalId.set($any($event.target).value)">
          @if (meta.filterOptions$ | async; as opts) {
            <option value="all">All in scope ({{ opts.hospitals.length }})</option>
            @for (h of opts.hospitals; track h.id) { <option [value]="h.id">{{ h.name }}</option> }
          } @else {
            <option value="all">All in scope</option>
          }
        </select>
      </label>
      <label class="field">Reporting period
        <select [value]="store.periodKey()" (change)="store.periodKey.set($any($event.target).value)">
          @for (p of presets; track p.key) { <option [value]="p.key">{{ p.label }}</option> }
        </select>
      </label>
      <ng-content />
    </div>
  `,
})
export class FilterBarComponent {
  protected readonly store = inject(FiltersStore);
  protected readonly meta = inject(MetaService);
  protected readonly presets = PERIOD_PRESETS;
}
