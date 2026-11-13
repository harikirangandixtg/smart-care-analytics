import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FiltersStore } from '../../core/state/filters.store';

/** Title, description, last-refreshed time and Refresh action (frontend spec §2 "content header"). Filters project in. */
@Component({
  selector: 'app-page-header',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="ph-title">
        <div class="row-gap">
          <h1>{{ title() }}</h1>
          @if (mock) { <span class="pill pill-warn">Synthetic POC data</span> }
        </div>
        <p class="muted">{{ description() }}</p>
        <div class="ph-meta">
          @if (updated()) { <span class="muted small">Updated {{ updated() | date: 'd MMM, HH:mm' }}</span> }
          @if (refreshable()) {
            <button type="button" class="link-btn" (click)="store.refresh()" aria-label="Refresh data">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
              Refresh
            </button>
          }
        </div>
      </div>
      <ng-content />
    </header>
  `,
})
export class PageHeaderComponent {
  protected readonly store = inject(FiltersStore);
  protected readonly mock = environment.useMockApi;
  readonly title = input.required<string>();
  readonly description = input('');
  readonly updated = input<Date | string | null | undefined>(null);
  readonly refreshable = input(true);
}
