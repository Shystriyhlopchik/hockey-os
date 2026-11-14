import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-news',
  standalone: true,
  imports: [],
  templateUrl: './office-news.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeNews {
  protected readonly vm = inject(LEAGUE_STATE);
}
