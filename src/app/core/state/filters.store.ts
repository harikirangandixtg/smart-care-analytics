import { Injectable, computed, signal } from '@angular/core';
import { DashboardFilters } from '../models/api.models';

export interface PeriodPreset { key: string; label: string; from: string; to: string }

/** Data window of the synthetic POC dataset; replace with /api/meta/filters dataTo when live. */
const DATA_TO = '2026-10-31';

export const PERIOD_PRESETS: PeriodPreset[] = [
  { key: 'ytd', label: 'Jan – Oct 2026', from: '2026-01-01', to: DATA_TO },
  { key: 'last6', label: 'Last 6 months', from: '2026-05-01', to: DATA_TO },
  { key: 'last3', label: 'Last 3 months', from: '2026-08-01', to: DATA_TO },
];

/** Shared dashboard filters (hospital + period), kept across pages for the session. */
@Injectable({ providedIn: 'root' })
export class FiltersStore {
  readonly hospitalId = signal<string>('all');
  readonly periodKey = signal<string>('ytd');

  readonly period = computed(() => PERIOD_PRESETS.find(p => p.key === this.periodKey()) ?? PERIOD_PRESETS[0]);

  readonly filters = computed<DashboardFilters>(() => ({
    hospitalIds: this.hospitalId() === 'all' ? [] : [this.hospitalId()],
    from: this.period().from,
    to: this.period().to,
  }));
}
