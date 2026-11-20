import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { NewsSummary } from '../../core/models/league';

@Component({
  selector: 'app-news-card',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './news-card.html',
  styleUrl: './news-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsCard {
  readonly news = input.required<NewsSummary>();
  readonly variant = input<'large' | 'small'>('small');
  protected readonly failedImage = signal<string | null>(null);
  protected readonly hasImage = computed(
    () => !!this.news().coverUrl && this.failedImage() !== this.news().coverUrl,
  );
}
