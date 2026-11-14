import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeagueMatch, Team } from '../../core/models/league';
import { matchDate, matchTime } from '../../core/format/match-format';
import { TeamBadge } from '../team-badge/team-badge';
@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [RouterLink, TeamBadge],
  templateUrl: './match-card.html',
  styleUrl: './match-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchCard {
  readonly match = input.required<LeagueMatch>();
  readonly teams = input.required<readonly Team[]>();
  readonly tournamentName = input('');
  readonly office = input(false);
  protected readonly home = computed(() =>
    this.teams().find((team) => team.id === this.match().homeTeamId),
  );
  protected readonly away = computed(() =>
    this.teams().find((team) => team.id === this.match().awayTeamId),
  );
  protected readonly date = matchDate;
  protected readonly time = matchTime;
}
