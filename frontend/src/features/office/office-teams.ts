import { TeamBadge } from '../../components/team-badge/team-badge';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-teams',
  standalone: true,
  imports: [TeamBadge, FormsModule],
  templateUrl: './office-teams.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeTeams {
  protected readonly vm = inject(LEAGUE_STATE);
}
