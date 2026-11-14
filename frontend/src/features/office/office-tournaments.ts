import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-tournaments',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './office-tournaments.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeTournaments {
  protected readonly vm = inject(LEAGUE_STATE);
}
