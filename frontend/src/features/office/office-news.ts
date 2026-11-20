import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { LEAGUE_STATE } from '../../core/state/league-state';
import { createNewsApi } from '../news/news-api';
import { NewsPagination } from '../../components/news-pagination/news-pagination';
import type { NewsSummary } from '../../core/models/league';
import { DestroyRef } from '@angular/core';

@Component({
  selector: 'app-office-news',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, NewsPagination],
  templateUrl: './office-news.html',
  styleUrl: './office-news.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeNews {
  protected readonly vm = inject(LEAGUE_STATE);
  private readonly api = createNewsApi();
  private readonly destroyRef = inject(DestroyRef);
  protected readonly page = signal(1);
  protected readonly status = signal('all');
  protected readonly search = signal('');
  protected readonly reload = signal(0);
  protected readonly processing = signal(false);
  protected readonly error = signal('');
  protected readonly state = toSignal(
    combineLatest([
      toObservable(this.page),
      toObservable(this.status),
      toObservable(this.search).pipe(debounceTime(250), distinctUntilChanged()),
      toObservable(this.reload),
    ]).pipe(
      switchMap(([page, status, search]) =>
        this.api.list(page, 12, true, status, search).pipe(
          map((result) => ({ ...result, loading: false, error: '' })),
          catchError((failure) =>
            of({
              items: [],
              total: 0,
              page,
              limit: 12,
              loading: false,
              error: failure.message as string,
            }),
          ),
          startWith({ items: [], total: 0, page, limit: 12, loading: true, error: '' }),
        ),
      ),
    ),
  );
  protected setFilter(value: string, kind: 'status' | 'search') {
    this.page.set(1);
    this[kind].set(value);
  }
  protected publication(item: NewsSummary) {
    if (this.processing()) return;
    if (
      item.published &&
      !window.confirm(`Снять новость «${item.title}» с публикации? Она исчезнет с сайта.`)
    )
      return;
    this.perform(this.api.publication(item, !item.published));
  }
  protected remove(item: NewsSummary) {
    if (
      this.processing() ||
      !window.confirm(`Удалить новость «${item.title}»? Она исчезнет с сайта и из списка.`)
    )
      return;
    this.perform(this.api.remove(item), true);
  }
  private perform(
    request: ReturnType<ReturnType<typeof createNewsApi>['remove']>,
    removed = false,
  ) {
    this.processing.set(true);
    this.error.set('');
    request
      .pipe(
        finalize(() => this.processing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (removed && this.state()?.items.length === 1 && this.page() > 1)
            this.page.update((page) => page - 1);
          this.reload.update((value) => value + 1);
          void this.vm.refresh();
        },
        error: (failure) => this.error.set(failure.message),
      });
  }
}
