import { TeamBadge } from '../../components/team-badge/team-badge';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-match-page',
  standalone: true,
  imports: [TeamBadge, RouterLink],
  templateUrl: './match-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
