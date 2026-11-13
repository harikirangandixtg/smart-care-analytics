import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MetadataService } from '../../core/services/metadata.service';
import { FiltersStore, PERIOD_PRESETS } from '../../core/state/filters.store';

/** Shared filters bound to FiltersStore. Options come from /api/metadata/{hospitals,departments,payers}. */
@Component({
  selector: 'app-filter-bar',
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters">
      <label class="field">Hospital
        <select [value]="store.hospitalId()" (change)="store.hospitalId.set($any($event.target).value)">
          @if (meta.hospitals$ | async; as list) {
            <option value="">All in scope ({{ list.length }})</option>
            @for (h of list; track h.id) { <option [value]="h.id" [selected]="h.id === store.hospitalId()">{{ h.name }}</option> }
          } @else { <option value="">All in scope</option> }
        </select>
      </label>
      @if (department()) {
        <label class="field">Department
          <select [value]="store.departmentId()" (change)="store.departmentId.set($any($event.target).value)">
            <option value="">All departments</option>
            @for (d of (meta.departments$ | async) ?? []; track d.id) { <option [value]="d.id" [selected]="d.id === store.departmentId()">{{ d.name }}</option> }
          </select>
        </label>
      }
      @if (payer()) {
        <label class="field">Payer
          <select [value]="store.payerId()" (change)="store.payerId.set($any($event.target).value)">
            <option value="">All payers</option>
            @for (p of (meta.payers$ | async) ?? []; track p.id) { <option [value]="p.id" [selected]="p.id === store.payerId()">{{ p.name }}</option> }
          </select>
        </label>
      }
      <label class="field">Reporting period
        <select [value]="store.periodKey()" (change)="store.periodKey.set($any($event.target).value)">
          @for (p of presets; track p.key) { <option [value]="p.key" [selected]="p.key === store.periodKey()">{{ p.label }}</option> }
        </select>
      </label>
      @if (granularity()) {
        <div class="field">
          <span>Group by</span>
          <div class="segmented" role="group" aria-label="Group by">
            @for (g of grains; track g.key) {
              <button type="button" [attr.aria-pressed]="store.granularity() === g.key" (click)="store.granularity.set(g.key)">{{ g.label }}</button>
            }
          </div>
        </div>
      }
      <ng-content />
    </div>
  `,
})
export class FilterBarComponent {
  protected readonly store = inject(FiltersStore);
  protected readonly meta = inject(MetadataService);
  protected readonly presets = PERIOD_PRESETS;
  protected readonly grains = [{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'quarter', label: 'Quarter' }] as const;
  readonly department = input(false);
  readonly payer = input(false);
  readonly granularity = input(false);
}
