import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-regulations-page',
  standalone: true,
  imports: [],
  templateUrl: './regulations-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegulationsPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
