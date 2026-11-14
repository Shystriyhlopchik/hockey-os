import { TeamBadge } from '../../components/team-badge/team-badge';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StandingsTable } from '../../components/standings-table/standings-table';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-tournaments-page',
  standalone: true,
  imports: [TeamBadge, FormsModule, RouterLink, StandingsTable],
  templateUrl: './tournaments-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentsPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
