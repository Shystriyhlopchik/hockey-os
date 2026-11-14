import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-news-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './news-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
