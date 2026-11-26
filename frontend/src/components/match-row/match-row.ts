import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LeagueMatch, Team } from '../../core/models/league';
import { matchDate, matchTime } from '../../core/format/match-format';
import { ScheduleStatus } from '../schedule-status/schedule-status';
import { hasPublicSchedule } from '../../features/calendar/schedule-status';
import { TeamBadge } from '../team-badge/team-badge';

@Component({
  selector: 'app-match-row',
  standalone: true,
  imports: [RouterLink, TeamBadge, ScheduleStatus],
  templateUrl: './match-row.html',
  styleUrl: './match-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchRow {
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
  protected readonly showSchedule = computed(
    () => this.office() || hasPublicSchedule(this.match()),
  );
  protected readonly date = matchDate;
  protected readonly time = matchTime;
}
