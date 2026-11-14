import { TeamBadge } from '../../components/team-badge/team-badge';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-teams-page',
  standalone: true,
  imports: [TeamBadge, FormsModule, RouterLink],
  templateUrl: './teams-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamsPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
