import { toIso } from './ask-adapter';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AgentExecution, AgentInfo, AgentInstructions, ExecutionStep, PipelineRun } from '../models/api.models';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STEP: Record<string, ExecutionStep['status']> = {
  pending: 'pending', queued: 'pending', running: 'running', in_progress: 'running', processing: 'running',
  completed: 'completed', complete: 'completed', ok: 'completed', success: 'completed', succeeded: 'completed', done: 'completed',
  failed: 'failed', error: 'failed', blocked: 'failed', skipped: 'skipped',
};
const stepStatus = (s: unknown, fallback: ExecutionStep['status']) => STEP[String(s ?? '').toLowerCase()] ?? fallback;

function toAgent(a: any, nameHint?: string): AgentInfo {
  if (typeof a === 'string') return { name: a };
  return {
    name: a?.name ?? a?.agent_name ?? a?.id ?? nameHint ?? '',
    display_name: a?.display_name ?? a?.title ?? undefined,
    version: a?.version ?? undefined,
    sha256: a?.sha256 ?? a?.hash ?? a?.checksum ?? undefined,
    description: a?.description ?? a?.summary ?? undefined,
    role: a?.role ?? undefined,
    responsibilities: Array.isArray(a?.responsibilities) ? a.responsibilities : undefined,
    inputs: a?.inputs ?? a?.input_schema ?? undefined,
    outputs: a?.outputs ?? a?.output_schema ?? undefined,
    file: a?.file ?? a?.path ?? a?.instructions_file ?? a?.source ?? undefined,
    model: a?.model ?? a?.deployment ?? undefined,
    status: a?.status ?? (a?.loaded === true ? 'loaded' : undefined),
    loaded_at: a?.loaded_at ?? a?.updated_at ?? undefined,
    raw: a,
  };
}

function toSteps(list: any[], ok: boolean): ExecutionStep[] {
  return list.map((s, i) => typeof s === 'string'
    ? { name: s, status: ok ? 'completed' : i === list.length - 1 ? 'failed' : 'completed' }
    : {
      name: s.name ?? s.step ?? s.agent ?? s.component ?? `Step ${i + 1}`,
      kind: s.kind ?? s.type ?? undefined,
      status: stepStatus(s.status, ok ? 'completed' : 'failed'),
      duration_ms: s.duration_ms ?? s.elapsed_ms ?? s.ms ?? undefined,
      version: s.version ?? undefined,
      sha256: s.sha256 ?? undefined,
      detail: s.detail ?? s.message ?? s.error ?? undefined,
    });
}

/**
 * /api/agents/* (admin key required). Responses are open objects in the OpenAPI spec, so everything
 * is read tolerantly. Uses only the four /api/agents endpoints in the OpenAPI spec.
 */
@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/agents`;

  list(): Observable<AgentInfo[]> {
    return this.http.get<any>(this.base).pipe(map(r => {
      const items = Array.isArray(r) ? r : r?.items ?? r?.agents ?? r?.data ?? null;
      if (Array.isArray(items)) return items.map(a => toAgent(a));
      if (r && typeof r === 'object') return Object.entries(r).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => toAgent(v, k));
      return [];
    }));
  }

  info(name: string): Observable<AgentInfo> {
    return this.http.get<any>(`${this.base}/${encodeURIComponent(name)}`).pipe(map(r => toAgent(r?.agent ?? r, name)));
  }

  instructions(name: string): Observable<AgentInstructions> {
    return this.http.get<any>(`${this.base}/${encodeURIComponent(name)}/instructions`).pipe(map(r => ({
      name,
      content: typeof r === 'string' ? r : r?.content ?? r?.markdown ?? r?.instructions ?? r?.text ?? r?.body ?? JSON.stringify(r, null, 2),
      file: r?.file ?? r?.path ?? undefined,
      version: r?.version ?? r?.frontmatter?.version ?? undefined,
      sha256: r?.sha256 ?? undefined,
      frontmatter: r?.frontmatter ?? r?.metadata ?? undefined,
    })));
  }

  execute(name: string, inputs: Record<string, unknown>): Observable<AgentExecution> {
    const started = performance.now();
    return this.http.post<any>(`${this.base}/${encodeURIComponent(name)}/execute`, { inputs }, { observe: 'response' }).pipe(map(res => {
      const r = res.body ?? {};
      const meta = r.meta ?? {};
      const ok = !(r.error || ['failed', 'error'].includes(String(r.status).toLowerCase()));
      const duration = r.duration_ms ?? meta.duration_ms ?? Math.round(performance.now() - started);
      const steps = r.steps ?? r.trace ?? r.timeline ?? meta.steps ?? null;
      return {
        agent: name, ok,
        status: r.status ?? (ok ? 'completed' : 'failed'),
        duration_ms: duration,
        measured_by: r.duration_ms ?? meta.duration_ms ? 'server' : 'browser',
        correlation_id: r.request_id ?? r.correlation_id ?? meta.request_id ?? res.headers.get('x-request-id') ?? res.headers.get('x-correlation-id') ?? undefined,
        output: r.output ?? r.result ?? r.data ?? r,
        error: typeof r.error === 'string' ? r.error : r.error?.message ?? undefined,
        steps: Array.isArray(steps) ? toSteps(steps, ok) : [{ name, kind: 'agent', status: ok ? 'completed' : 'failed', duration_ms: duration }],
        at: new Date().toISOString(),
      } satisfies AgentExecution;
    }));
  }

  /** The latest AI Analytics run: GET /api/analytics/history?limit=1 → GET /api/analytics/{query_id} (raw meta). */
  lastRun(): Observable<PipelineRun | null> {
    const api = `${environment.apiBaseUrl}/api/analytics`;
    return this.http.get<any>(`${api}/history`, { params: { limit: 1, offset: 0 } }).pipe(
      switchMap(h => {
        const item = (h?.items ?? (Array.isArray(h) ? h : []))[0];
        return item?.query_id ? this.http.get<any>(`${api}/${encodeURIComponent(item.query_id)}`).pipe(map(r => ({ item, r }))) : of(null);
      }),
      map(x => {
        if (!x) return null;
        const { item, r } = x;
        const meta = r?.meta ?? {};
        const status = String(r?.status ?? item.status ?? '');
        const ok = ['ok', 'success', 'completed'].includes(status);
        const list = meta.steps ?? meta.trace ?? meta.agents ?? r?.agents_used ?? [];
        return {
          query_id: item.query_id,
          question: r?.question ?? item.question,
          status,
          ok,
          created_at: toIso(item.created_at ?? meta.created_at) || undefined,
          duration_ms: meta.duration_ms ?? r?.execution_time_ms ?? null,
          correlation_id: meta.request_id ?? meta.correlation_id ?? r?.request_id ?? null,
          steps: toSteps(Array.isArray(list) ? list : [], ok),
          error: ok ? null : r?.answer?.summary ?? r?.message ?? r?.error ?? null,
        } satisfies PipelineRun;
      }),
    );
  }
}
