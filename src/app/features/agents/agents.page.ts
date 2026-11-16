import { DatePipe, JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { of } from 'rxjs';
import { AgentExecution, AgentInfo, ExecutionStep } from '../../core/models/api.models';
import { AgentService } from '../../core/services/agent.service';
import { errorMessage, requestState } from '../../core/utils/request-state';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** The orchestration flow from the POC design; agents are matched to the API's names by alias. */
interface PipelineStage { key: string; label: string; kind: 'agent' | 'component'; impl: string; job: string; aliases: string[] }
const PIPELINE: PipelineStage[] = [
  { key: 'planner', label: 'Analytics Planner', kind: 'agent', impl: 'agents/analytics_planner.md', job: 'Finds metric, dimensions, period and filters; produces a structured plan', aliases: ['analytics-planner', 'planner'] },
  { key: 'sql', label: 'SQL Generator', kind: 'agent', impl: 'agents/sql_generator.md', job: 'Drafts a PostgreSQL query against the approved schema', aliases: ['sql-drafter', 'sql-generator', 'sql-writer'] },
  { key: 'validator', label: 'SQL Validator', kind: 'component', impl: 'Deterministic Python', job: 'Enforces query safety, access scope, allowlists and limits', aliases: [] },
  { key: 'db', label: 'Database Plugin', kind: 'component', impl: 'Semantic Kernel plugin', job: 'Runs approved queries only, through a read-only identity', aliases: [] },
  { key: 'insights', label: 'Insights Agent', kind: 'agent', impl: 'agents/insights_agent.md', job: 'Explains the aggregate results that came back', aliases: ['insights-writer', 'insights-agent', 'insights'] },
  { key: 'chart', label: 'Chart Formatter', kind: 'agent', impl: 'agents/chart_formatter.md', job: 'Produces chart JSON that matches the frontend chart contract', aliases: ['chart-advisor', 'chart-formatter'] },
];

const SAMPLE_QUESTION = 'What is the denial rate by payer for the last 2 months?';

/**
 * Agent monitor (restricted). APIs: GET /api/agents, GET /api/agents/{name}, GET /api/agents/{name}/instructions,
 * POST /api/agents/{name}/execute (all with x-admin-key), plus GET /api/analytics/history + /{query_id} for the
 * latest pipeline run's trace.
 */
@Component({
  selector: 'app-agents-page',
  imports: [DatePipe, JsonPipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agents.page.html',
  styleUrl: './agents.page.scss',
})
export class AgentsPage {
  private readonly api = inject(AgentService);

  private readonly tick = signal(0);
  protected readonly selected = signal<string | null>(null);
  protected readonly tab = signal<'overview' | 'instructions' | 'test'>('overview');

  protected readonly agents = requestState(this.tick, () => this.api.list());
  protected readonly info = requestState(this.selected, n => (n ? this.api.info(n) : of(null)));
  protected readonly instructions = requestState(
    computed(() => (this.tab() === 'instructions' ? { n: this.selected() } : null)),
    s => (s?.n ? this.api.instructions(s.n) : of(null)),
  );
  protected readonly lastRun = requestState(this.tick, () => this.api.lastRun());

  /** Agent detail = list entry merged with GET /api/agents/{name}. */
  protected readonly agent = computed<AgentInfo | null>(() => {
    const n = this.selected();
    if (!n) return null;
    const base = this.agents().data?.find(a => a.name === n) ?? { name: n };
    const more = this.info().data;
    if (!more) return base;
    const merged: AgentInfo = { ...base };
    for (const [k, v] of Object.entries(more)) if (v !== undefined && v !== null && v !== '') (merged as unknown as Record<string, unknown>)[k] = v;
    return merged;
  });
  protected readonly extra = computed(() => {
    const raw = (this.agent()?.raw ?? null) as Record<string, unknown> | null;
    const known = new Set(['name', 'agent_name', 'id', 'display_name', 'title', 'version', 'sha256', 'hash', 'checksum', 'description', 'summary', 'role', 'responsibilities', 'inputs', 'input_schema', 'outputs', 'output_schema', 'file', 'path', 'instructions_file', 'source', 'model', 'deployment', 'status', 'loaded', 'loaded_at', 'updated_at']);
    return raw && typeof raw === 'object' ? Object.entries(raw).filter(([k, v]) => !known.has(k) && v !== null && v !== undefined) : [];
  });

  /** Agents in orchestration-flow order; any agent not in the flow goes last, by name. */
  protected readonly ordered = computed(() => {
    const rank = (n: string) => { const i = PIPELINE.findIndex(s => s.aliases.includes(n)); return i < 0 ? PIPELINE.length : i; };
    return [...(this.agents().data ?? [])].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  });

  protected readonly pipeline = computed(() => {
    const names = new Set((this.agents().data ?? []).map(a => a.name));
    return PIPELINE.map(s => ({ ...s, match: s.aliases.find(a => names.has(a)) ?? null }));
  });
  protected readonly authProblem = computed(() => /access|session has expired|\(401\)|\(403\)/i.test(this.agents().error ?? ''));

  // ---- test action
  protected readonly inputs = signal(JSON.stringify({ question: SAMPLE_QUESTION }, null, 2));
  protected readonly inputError = signal<string | null>(null);
  protected readonly running = signal(false);
  protected readonly execution = signal<AgentExecution | null>(null);
  protected readonly execError = signal<string | null>(null);
  protected readonly execStatus = signal<number | null>(null);

  constructor() {
    effect(() => {
      const list = this.agents().data;
      if (list?.length && (!this.selected() || !list.some(a => a.name === this.selected()))) this.selected.set(this.ordered()[0].name);
    });
  }

  protected refresh(): void { this.tick.update(t => t + 1); }

  protected select(name: string): void {
    if (name === this.selected()) return;
    this.selected.set(name);
    this.execution.set(null); this.execError.set(null); this.inputError.set(null);
  }

  protected run(): void {
    const name = this.selected();
    if (!name || this.running()) return;
    let inputs: Record<string, unknown>;
    try {
      const v = JSON.parse(this.inputs() || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Inputs must be a JSON object, for example {"question": "…"}');
      inputs = v;
    } catch (e) { this.inputError.set(e instanceof Error ? e.message : 'Inputs are not valid JSON.'); return; }
    this.inputError.set(null); this.execError.set(null); this.execution.set(null); this.execStatus.set(null);
    this.running.set(true);
    this.api.execute(name, inputs).subscribe({
      next: r => { this.execution.set(r); this.running.set(false); },
      error: e => { this.execError.set(errorMessage(e)); this.execStatus.set(e instanceof HttpErrorResponse ? e.status : null); this.running.set(false); },
    });
  }

  protected resetInputs(): void { this.inputs.set(JSON.stringify({ question: SAMPLE_QUESTION }, null, 2)); this.inputError.set(null); }

  protected short(sha?: string): string { return sha ? sha.slice(0, 12) : '—'; }
  protected isText(v: unknown): boolean { return typeof v === 'string'; }
  protected stageFor(name: string): string | null {
    return PIPELINE.find(s => s.aliases.includes(name))?.label ?? null;
  }
  /** Bar widths for the timeline, relative to the longest measured step. */
  protected width(step: ExecutionStep, steps: ExecutionStep[]): number {
    const max = Math.max(...steps.map(s => s.duration_ms ?? 0));
    return step.duration_ms && max ? Math.max(4, Math.round((step.duration_ms / max) * 100)) : 0;
  }
  protected secs(ms?: number | null): string { return ms === null || ms === undefined ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`; }
}
