import { goalSituationLabel, penaltyStart } from '../../../../shared/protocol-details.js';
import { PlayerLink } from '../../components/player-link/player-link';
import { OfficialCrew } from '../../components/official-crew/official-crew';
import { chronologicalGoals, sortRoster } from '../protocol/protocol-order';
import { TeamBadge } from '../../components/team-badge/team-badge';
import { ScheduleStatus } from '../../components/schedule-status/schedule-status';
import { hasPublicSchedule } from '../calendar/schedule-status';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-match-page',
  standalone: true,
  imports: [ScheduleStatus, TeamBadge, RouterLink, PlayerLink, OfficialCrew],
  templateUrl: './match-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchPage {
  protected readonly goalSituationLabel = goalSituationLabel;
  protected readonly penaltyStart = penaltyStart;
  protected readonly hasPublicSchedule = hasPublicSchedule;
  protected readonly vm = inject(LEAGUE_STATE);
  protected readonly goals = computed(() =>
    chronologicalGoals<any>(this.vm.detail()?.protocol?.goals || []),
  );
  protected readonly rosters = computed(() => [
    {
      teamId: this.vm.detail()?.match.homeTeamId,
      rows: sortRoster<any>(this.vm.detail()?.protocol?.homeRoster || []),
    },
    {
      teamId: this.vm.detail()?.match.awayTeamId,
      rows: sortRoster<any>(this.vm.detail()?.protocol?.awayRoster || []),
    },
  ]);
}
