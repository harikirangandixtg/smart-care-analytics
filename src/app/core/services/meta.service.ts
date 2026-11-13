import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FilterOptions } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Hospitals in the user's access, departments, payers, data window. Cached for the session. */
  readonly filterOptions$: Observable<FilterOptions> = this.http
    .get<FilterOptions>(`${this.base}/api/meta/filters`)
    .pipe(shareReplay(1));

  health(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.base}/health`);
  }
}
