import { Injectable, computed, signal } from '@angular/core';
import { DashboardFilters, Granularity } from '../models/api.models';

export interface PeriodPreset { key: string; label: string; date_from: string; date_to: string }

/** OpenAPI has no /api/metadata/date-ranges, so presets are defined here. Replace DATA_TO from data when available. */
const DATA_TO = '2026-10-31';
export const PERIOD_PRESETS: PeriodPreset[] = [
  { key: 'ytd', label: 'Jan – Oct 2026', date_from: '2026-01-01', date_to: DATA_TO },
  { key: 'last6', label: 'Last 6 months', date_from: '2026-05-01', date_to: DATA_TO },
  { key: 'last3', label: 'Last 3 months', date_from: '2026-08-01', date_to: DATA_TO },
];

/**
 * Global filters kept across screens (frontend spec §2: "preserve selected filters when navigating").
 * Frontend filters are not a security boundary: the API narrows hospital scope server-side.
 */
@Injectable({ providedIn: 'root' })
export class FiltersStore {
  readonly hospitalId = signal<string>('');     // '' = all in scope
  readonly departmentId = signal<string>('');
  readonly payerId = signal<string>('');
  readonly periodKey = signal<string>('ytd');
  readonly granularity = signal<Granularity>('month');
  /** Bumped by the Refresh button; included in every request source so pages re-fetch. */
  readonly refreshTick = signal(0);

  readonly period = computed(() => PERIOD_PRESETS.find(p => p.key === this.periodKey()) ?? PERIOD_PRESETS[0]);

  readonly filters = computed<DashboardFilters>(() => {
    this.refreshTick();
    const one = (v: string) => (v ? [v] : []);
    return {
      date_from: this.period().date_from,
      date_to: this.period().date_to,
      hospital_id: one(this.hospitalId()),
      department_id: one(this.departmentId()),
      payer_id: one(this.payerId()),
    };
  });

  refresh(): void { this.refreshTick.update(n => n + 1); }
}
