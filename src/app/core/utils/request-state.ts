import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';

export interface RequestState<T> {
  loading: boolean;
  data?: T;
  error?: string;
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return err.error?.message ?? (err.status === 0 ? 'The analytics service is unreachable.' : `Request failed (${err.status}).`);
  }
  return 'Something went wrong.';
}

/**
 * Re-fetches whenever `source` changes and exposes loading / data / error as a signal.
 * Must be called in an injection context (e.g. a component field initializer).
 */
export function requestState<S, T>(source: Signal<S>, fetch: (s: S) => Observable<T>): Signal<RequestState<T>> {
  return toSignal(
    toObservable(source).pipe(
      switchMap(s =>
        fetch(s).pipe(
          map(data => ({ loading: false, data }) as RequestState<T>),
          catchError(err => of({ loading: false, error: errorMessage(err) } as RequestState<T>)),
          startWith({ loading: true } as RequestState<T>),
        ),
      ),
    ),
    { initialValue: { loading: true } },
  );
}
