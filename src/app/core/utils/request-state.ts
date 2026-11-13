import { HttpErrorResponse } from '@angular/common/http';
import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { HttpValidationError } from '../models/api.models';

export interface RequestState<T> {
  loading: boolean;
  data?: T;
  error?: string;
  loadedAt?: Date;
}

/** Safe, user-facing message. Never shows stack traces (frontend spec §15). */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'The analytics service is unreachable. Check your connection and retry.';
    if (err.status === 401) return 'Your session has expired. Sign in again.';
    if (err.status === 403) return 'You do not have access to this data.';
    if (err.status === 422) {
      const d = (err.error as HttpValidationError | undefined)?.detail;
      if (Array.isArray(d) && d.length) return `Invalid request: ${d.map(x => `${x.loc.slice(1).join('.')} ${x.msg}`).join('; ')}`;
      return 'Some filters are not valid.';
    }
    if (err.status === 504 || err.status === 408) return 'The request timed out. Try a smaller date range or retry.';
    const msg = (err.error as { message?: string; detail?: string } | null);
    if (typeof msg?.message === 'string') return msg.message;
    if (typeof msg?.detail === 'string') return msg.detail;
    return `The service returned an error (${err.status}). Retry in a moment.`;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

/** Re-fetches whenever `source` changes. Call in an injection context. */
export function requestState<S, T>(source: Signal<S>, fetch: (s: S) => Observable<T>): Signal<RequestState<T>> {
  return toSignal(
    toObservable(source).pipe(
      switchMap(s =>
        fetch(s).pipe(
          map(data => ({ loading: false, data, loadedAt: new Date() }) as RequestState<T>),
          catchError(err => of({ loading: false, error: errorMessage(err) } as RequestState<T>)),
          startWith({ loading: true } as RequestState<T>),
        ),
      ),
    ),
    { initialValue: { loading: true } },
  );
}
