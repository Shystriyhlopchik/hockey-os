import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Standing } from '../../core/models/league';
import { TeamBadge } from '../team-badge/team-badge';
@Component({
  selector: 'app-standings-table',
  standalone: true,
  imports: [RouterLink, TeamBadge],
  templateUrl: './standings-table.html',
  styleUrl: './standings-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandingsTable {
  readonly rows = input.required<readonly Standing[]>();
  readonly compact = input(false);
}
