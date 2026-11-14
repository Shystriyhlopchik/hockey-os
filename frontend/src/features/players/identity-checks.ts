import {
  catchError,
  EMPTY,
  map,
  of,
  switchMap,
  timer,
  type Observable,
  type SchedulerLike,
} from 'rxjs';
export interface IdentityInput {
  key: string;
  revision: number;
  query: Record<string, unknown>;
}
export interface IdentityResult {
  matches: { id: number; name: string }[];
  unchanged: boolean;
}

/** A new spelling or a closed dialog cancels both the debounce and the HTTP request. */
export function identityChecks(
  input: Observable<IdentityInput | null>,
  lookup: (query: Record<string, unknown>) => Observable<IdentityResult>,
  scheduler?: SchedulerLike,
) {
  return input.pipe(
    switchMap((item) =>
      item
        ? timer(300, scheduler).pipe(
            switchMap(() => lookup(item.query)),
            map((result) => ({ ...item, result, failure: '' })),
            catchError((failure: Error) => of({ ...item, result: null, failure: failure.message })),
          )
        : EMPTY,
    ),
  );
}
