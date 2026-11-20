import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { createNewsApi } from '../../features/news/news-api';
import { NewsCard } from '../news-card/news-card';

@Component({
  selector: 'app-news-preview',
  standalone: true,
  imports: [NewsCard],
  templateUrl: './news-preview.html',
  styleUrl: './news-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsPreview {
  readonly limit = input(6);
  private readonly api = createNewsApi();
  protected readonly retry = signal(0);
  protected readonly state = toSignal(
    combineLatest([toObservable(this.limit), toObservable(this.retry)]).pipe(
      switchMap(([limit]) =>
        this.api.list(1, limit).pipe(
          map((page) => ({ items: page.items, loading: false, error: '' })),
          catchError(() =>
            of({ items: [], loading: false, error: 'Не удалось загрузить новости' }),
          ),
          startWith({ items: [], loading: true, error: '' }),
        ),
      ),
    ),
  );
}
