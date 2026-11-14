import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerStat, Team } from '../../core/models/league';
import { TeamBadge } from '../team-badge/team-badge';
@Component({
  selector: 'app-leader-board',
  standalone: true,
  imports: [RouterLink, TeamBadge],
  templateUrl: './leader-board.html',
  styleUrl: './leader-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderBoard {
  readonly title = input.required<string>();
  readonly metric = input.required<'points' | 'goals' | 'assists'>();
  readonly rows = input.required<readonly PlayerStat[]>();
  readonly teams = input.required<readonly Team[]>();
  protected readonly leaders = computed(() =>
    [...this.rows()]
      .filter((row) => row.games > 0)
      .sort(
        (a, b) =>
          b[this.metric()] - a[this.metric()] ||
          b.points - a.points ||
          a.name.localeCompare(b.name, 'ru'),
      )
      .slice(0, 3),
  );
  protected readonly first = computed(() => this.leaders()[0]);
  protected team(id: number) {
    return this.teams().find((team) => team.id === id);
  }
  protected initials(name: string) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('');
  }
}
