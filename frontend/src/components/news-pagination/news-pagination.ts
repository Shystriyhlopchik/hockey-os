import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
@Component({
  selector: 'app-news-pagination',
  standalone: true,
  templateUrl: './news-pagination.html',
  styleUrl: './news-pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsPagination {
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly limit = input.required<number>();
  readonly pageChange = output<number>();
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
}
