import type { Observable } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, EMPTY, finalize, map, of, switchMap, tap } from 'rxjs';
import { LEAGUE_STATE } from '../../core/state/league-state';
import { createNewsApi } from './news-api';
import type { NewsItem } from '../../core/models/league';

@Component({
  selector: 'app-news-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './news-editor.html',
  styleUrl: './news-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsEditor {
  protected readonly vm = inject(LEAGUE_STATE);
  private readonly api = createNewsApi();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private savedNotice = this.router.getCurrentNavigation()?.extras.state?.['newsSaved'] as
    | string
    | undefined;
  protected readonly id = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly published = signal(false);
  protected readonly slugLocked = signal(false);
  protected readonly coverPreview = signal<string | null>(null);
  protected readonly preview = signal(false);
  private version?: string;
  private coverUrl: string | null = null;
  private file: File | null = null;
  private objectUrl: string | null = null;
  protected readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(200),
        Validators.pattern(/\S/),
      ],
    ],
    slug: ['', [Validators.maxLength(200), Validators.pattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)]],
    category: [
      'Сообщество',
      [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)],
    ],
    excerpt: ['', Validators.maxLength(500)],
    body: ['', [Validators.required, Validators.maxLength(50000), Validators.pattern(/\S/)]],
  });
  protected readonly previewBody = signal('');
  protected readonly previewTitle = signal('');
  protected readonly previewExcerpt = signal('');

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.vm.dirty.set(true);
      this.updatePreview();
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        switchMap((id) => {
          this.loading.set(true);
          this.error.set('');
          this.loadFailed.set(false);
          const nextId = id ? Number(id) : null;
          if (this.id() !== nextId) this.notice.set('');
          this.id.set(nextId);
          const request: Observable<NewsItem | null> = id ? this.api.article(id, true) : of(null);
          return request.pipe(
            catchError((failure) => {
              this.loading.set(false);
              this.loadFailed.set(true);
              this.error.set(failure.message);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (news) => {
          this.apply(news);
          if (this.savedNotice) {
            this.notice.set(this.savedNotice);
            this.savedNotice = undefined;
          }
          this.loading.set(false);
        },
      });
    this.destroyRef.onDestroy(() => {
      this.revoke();
      this.vm.dirty.set(false);
    });
  }
  protected togglePreview() {
    this.updatePreview();
    this.preview.update((value) => !value);
  }
  private updatePreview() {
    const value = this.form.getRawValue();
    this.previewBody.set(value.body);
    this.previewTitle.set(value.title);
    this.previewExcerpt.set(value.excerpt);
  }
  private apply(news: NewsItem | null) {
    this.revoke();
    this.file = null;
    this.coverUrl = news?.coverUrl || null;
    this.coverPreview.set(this.coverUrl);
    this.version = news?.updatedAt;
    this.published.set(!!news?.published);
    this.slugLocked.set(!!news?.slugLocked);
    this.form.reset(
      {
        title: news?.title || '',
        slug: news?.slug || '',
        category: news?.category || 'Сообщество',
        excerpt: news?.excerpt || '',
        body: news?.body || '',
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();
    this.vm.dirty.set(false);
    this.updatePreview();
  }
  protected save(publish: boolean) {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || this.loading()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    const value = this.form.getRawValue();
    const upload = this.file
      ? this.api.cover(this.file).pipe(
          tap((result) => {
            this.coverUrl = result.url;
            this.file = null;
          }),
          map((result) => result.url),
        )
      : of(this.coverUrl);
    upload
      .pipe(
        switchMap((coverUrl) =>
          this.api.save(this.id(), {
            ...Object.fromEntries(Object.entries(value).map(([key, value]) => [key, value.trim()])),
            coverUrl,
            published: publish,
            expectedUpdatedAt: this.version,
          }),
        ),
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (news) => {
          const isNew = !this.id();
          this.id.set(news.id);
          this.apply(news);
          this.notice.set(publish ? 'Новость опубликована на сайте' : 'Черновик сохранён');
          // Refresh public previews without making a successful save depend on the snapshot request.
          void this.vm.refresh();
          if (isNew)
            void this.router.navigate(['/office/news', news.id, 'edit'], {
              replaceUrl: true,
              state: { newsSaved: this.notice() },
            });
        },
        error: (failure) => this.error.set(failure.message),
      });
  }
  protected selectCover(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      this.error.set('Выберите PNG, JPEG или WebP размером до 5 МБ');
      return;
    }
    this.revoke();
    this.file = file;
    this.objectUrl = URL.createObjectURL(file);
    this.coverPreview.set(this.objectUrl);
    this.vm.dirty.set(true);
    this.form.markAsDirty();
    this.error.set('');
  }
  protected removeCover() {
    this.revoke();
    this.file = null;
    this.coverUrl = null;
    this.coverPreview.set(null);
    this.vm.dirty.set(true);
    this.form.markAsDirty();
  }
  private revoke() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
