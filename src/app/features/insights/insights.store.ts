import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AskResponse, DashboardFilters } from '../../core/models/api.models';
import { AnalyticsService } from '../../core/services/analytics.service';
import { toAskFilters } from '../../core/services/http-params';
import { errorMessage } from '../../core/utils/request-state';

export interface InsightTopic { id: string; title: string; question: string; custom?: boolean }

/** Questions the screen asks through POST /api/analytics/ask. Each answer is one insight card. */
export const TOPICS: InsightTopic[] = [
  { id: 'admissions-trend', title: 'Admissions trend', question: 'What is the monthly number of admissions?' },
  { id: 'denial-payer', title: 'Denial rate by payer', question: 'What is the denial rate by payer?' },
  { id: 'los-department', title: 'Length of stay by department', question: 'What is the average length of stay by department?' },
  { id: 'denial-trend', title: 'Denial rate trend', question: 'What is the monthly denial rate?' },
  { id: 'pending-payer', title: 'Pending claims by payer', question: 'How many claims are pending by payer?' },
  { id: 'claim-amount-trend', title: 'Claim amount trend', question: 'What is the monthly claim amount?' },
];

export interface InsightState { topic: InsightTopic; status: 'idle' | 'queued' | 'loading' | 'done' | 'error'; res?: AskResponse; error?: string }

/**
 * Runs the insight questions two at a time (each /ask call runs the full agent pipeline) and keeps the
 * results for the filters they were asked with, so returning to the screen doesn't re-run them.
 */
@Injectable({ providedIn: 'root' })
export class InsightsStore {
  private readonly api = inject(AnalyticsService);
  private subs: Subscription[] = [];
  private queue: InsightState[] = [];

  readonly items = signal<InsightState[]>(TOPICS.map(topic => ({ topic, status: 'idle' })));
  /** Filters the current results were produced with (null = not run yet). */
  readonly ranWith = signal<{ key: string; filters: DashboardFilters; at: Date } | null>(null);

  static key(f: DashboardFilters): string { return JSON.stringify([f.date_from, f.date_to, f.hospital_id, f.department_id, f.payer_id]); }

  runAll(f: DashboardFilters): void {
    this.cancel();
    this.ranWith.set({ key: InsightsStore.key(f), filters: f, at: new Date() });
    this.items.update(list => list.map(i => ({ topic: i.topic, status: 'queued' })));
    this.queue = [...this.items()];
    this.pump(f); this.pump(f);
  }

  /** Adds a question of your own as an extra card. */
  addCustom(question: string, f: DashboardFilters): void {
    const topic: InsightTopic = { id: `custom-${Date.now()}`, title: 'Your question', question: question.trim().slice(0, 500), custom: true };
    const state: InsightState = { topic, status: 'queued' };
    this.items.update(list => [...list, state]);
    if (!this.ranWith()) this.ranWith.set({ key: InsightsStore.key(f), filters: f, at: new Date() });
    this.ask(state, this.ranWith()!.filters);
  }

  rerun(id: string): void {
    const s = this.items().find(i => i.topic.id === id);
    if (s && this.ranWith()) this.ask(s, this.ranWith()!.filters);
  }

  remove(id: string): void { this.items.update(list => list.filter(i => i.topic.id !== id)); }

  cancel(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = []; this.queue = [];
    this.items.update(list => list.map(i => (i.status === 'queued' || i.status === 'loading' ? { topic: i.topic, status: 'idle' } : i)));
  }

  private pump(f: DashboardFilters): void {
    const next = this.queue.shift();
    if (next) this.ask(next, f, () => this.pump(f));
  }

  private ask(s: InsightState, f: DashboardFilters, done?: () => void): void {
    this.patch(s.topic.id, { status: 'loading', error: undefined });
    // The screen's period is part of the scope here (unlike AI Analytics, where the question sets the period).
    const sub = this.api.ask({ question: s.topic.question, filters: toAskFilters(f, true), conversation_id: null }).subscribe({
      next: res => { this.patch(s.topic.id, { status: 'done', res }); done?.(); },
      error: e => { this.patch(s.topic.id, { status: 'error', error: errorMessage(e) }); done?.(); },
    });
    this.subs.push(sub);
  }

  private patch(id: string, p: Partial<InsightState>): void {
    this.items.update(list => list.map(i => (i.topic.id === id ? { ...i, ...p } : i)));
  }
}
