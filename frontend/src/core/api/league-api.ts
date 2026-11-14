import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, firstValueFrom, throwError } from 'rxjs';
/** One HTTP boundary. Read streams can be cancelled by switchMap. */
export function createLeagueApi() {
  const http = inject(HttpClient);
  function request$<T = any>(path: string, method = 'GET', body?: unknown) {
    return http.request<T>(method, '/api/' + path, { body }).pipe(
      catchError((error: HttpErrorResponse) => {
        const failure = new Error(error.error?.message || 'Не удалось выполнить запрос');
        return throwError(() => Object.assign(failure, { status: error.status }));
      }),
    );
  }
  const request = <T = any>(path: string, method = 'GET', body?: unknown) =>
    firstValueFrom(request$<T>(path, method, body));
  return { request$, request };
}
