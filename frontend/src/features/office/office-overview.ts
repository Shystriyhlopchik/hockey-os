import { MatchRow } from '../../components/match-row/match-row';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-overview',
  standalone: true,
  imports: [MatchRow, RouterLink],
  templateUrl: './office-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeOverview {
  protected readonly vm = inject(LEAGUE_STATE);
}
