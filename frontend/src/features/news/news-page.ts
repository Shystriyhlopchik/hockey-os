import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, startWith, switchMap, Observable } from 'rxjs';
import { createNewsApi } from './news-api';
import { NewsCard } from '../../components/news-card/news-card';
import { NewsPagination } from '../../components/news-pagination/news-pagination';
import type { NewsItem, NewsPageResult } from '../../core/models/league';

interface PageState {
  article: NewsItem | null;
  result: NewsPageResult | null;
  loading: boolean;
  error: string;
}
@Component({
  selector: 'app-news-page',
  standalone: true,
  imports: [RouterLink, DatePipe, NewsCard, NewsPagination],
  templateUrl: './news-page.html',
  styleUrl: './news-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsPage {
  private readonly api = createNewsApi();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly retry = signal(0);
  protected readonly failedCover = signal('');
  protected readonly state = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap, toObservable(this.retry)]).pipe(
      switchMap(([params, query]) => {
        const key = params.get('id');
        const page = Math.max(1, Number(query.get('page')) || 1);
        const request: Observable<Pick<PageState, 'article' | 'result'>> = key
          ? this.api.article(key).pipe(map((article) => ({ article, result: null })))
          : this.api.list(page, 12).pipe(map((result) => ({ article: null, result })));
        return request.pipe(
          map((value) => ({ ...value, loading: false, error: '' }) as PageState),
          catchError((failure) =>
            of({
              article: null,
              result: null,
              loading: false,
              error:
                failure.status === 404
                  ? 'Новость не найдена или снята с публикации'
                  : failure.message,
            } as PageState),
          ),
          startWith({ article: null, result: null, loading: true, error: '' } as PageState),
        );
      }),
    ),
  );
  protected readonly paragraphs = computed(
    () =>
      this.state()
        ?.article?.body.split(/\r?\n\s*\r?\n/)
        .filter(Boolean) || [],
  );
  constructor() {
    effect(() => {
      const item = this.state()?.article;
      const key = this.route.snapshot.paramMap.get('id');
      if (item?.slug && key && /^\d+$/.test(key) && item.slug !== key)
        void this.router.navigate(['/news', item.slug], { replaceUrl: true });
    });
  }
  protected changePage(page: number) {
    void this.router.navigate(['/news'], { queryParams: { page: page === 1 ? null : page } });
  }
}
