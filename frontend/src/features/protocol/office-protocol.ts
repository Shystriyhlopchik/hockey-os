import {
  GOAL_STRENGTHS,
  GOAL_TYPES,
  goalContext,
  goalContextPatch,
  penaltyStart,
  penaltyStartPatch,
  penaltyTimingMode,
  penaltyModePatch,
} from '../../../../shared/protocol-details.js';
import type { GoalStrength, GoalType } from '../../../../shared/protocol-details.js';
import { goalieSummary, formatGoalieTime } from '../../../../shared/goalie-statistics.js';
import { GoalieTable } from '../../components/goalie-table/goalie-table';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TeamBadge } from '../../components/team-badge/team-badge';
import { ProtocolSheet } from '../../components/protocol-sheet/protocol-sheet';
import { LEAGUE_STATE } from '../../core/state/league-state';
import { newestEventEntries } from './protocol-order';

@Component({
  selector: 'app-office-protocol',
  standalone: true,
  imports: [TeamBadge, FormsModule, RouterLink, ProtocolSheet, GoalieTable],
  templateUrl: './office-protocol.html',
  styleUrl: './office-protocol.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeProtocol {
  protected readonly goalStrengths = GOAL_STRENGTHS;
  protected readonly goalTypes = GOAL_TYPES;
  protected readonly goalContext = goalContext;
  protected readonly penaltyStart = penaltyStart;
  protected readonly penaltyTimingMode = penaltyTimingMode;
  protected readonly bestPlayerOptions = computed(() => {
    const p = this.vm.protocol();
    if (!p || p.resolution === 'technical' || p.detailLevel !== 'full') return [];
    return this.vm.protocolTeams().flatMap((teamId: number) =>
      this.vm
        .rosterOptions(teamId)
        .filter((r: any) => r.played)
        .map((r: any) => ({ ...r, teamId })),
    );
  });
  protected readonly bestPlayerAvailable = computed(() =>
    this.bestPlayerOptions().some((r: any) => r.playerId === this.vm.protocol()?.bestPlayerId),
  );
  protected setGoalStrength(goal: any, strength: GoalStrength | null): void {
    this.vm.patchProtocolItem(goal, { ...goalContextPatch(goal, { strength }) });
  }
  protected setGoalType(goal: any, goalType: GoalType): void {
    this.vm.patchProtocolItem(goal, { ...goalContextPatch(goal, { goalType }) });
  }
  protected setPenaltyStart(penalty: any, start: string): void {
    this.vm.patchProtocolItem(penalty, penaltyStartPatch(penalty, start));
  }
  protected setPenaltySeparate(penalty: any, separate: boolean): void {
    this.vm.patchProtocolItem(penalty, penaltyModePatch(penalty, separate));
  }
  protected readonly vm = inject(LEAGUE_STATE);
  private readonly injector = inject(Injector);
  private readonly goalList = viewChild<ElementRef<HTMLElement>>('goalList');
  private readonly penaltyList = viewChild<ElementRef<HTMLElement>>('penaltyList');
  protected readonly goals = computed(() =>
    newestEventEntries<any>(this.vm.protocol()?.goals || []),
  );

  protected readonly penalties = computed(() =>
    newestEventEntries<any>(this.vm.protocol()?.penalties || []),
  );

  protected readonly keeperSummary = computed(() =>
    goalieSummary(this.vm.protocol(), this.vm.detail().match, this.vm.detail().tournament.rules),
  );
  protected readonly keeperRows = computed(() =>
    this.keeperSummary().rows.map((row) => ({
      playerId: row.playerId,
      teamId: row.teamId,
      tournamentId: this.vm.detail().match.tournamentId,
      name: this.vm.playerName(row.playerId),
      position: 'G',
      games: row.participated ? 1 : 0,
      goals: 0,
      assists: 0,
      points: 0,
      penaltyMinutes: 0,
      goalieSeconds: row.seconds,
      goalieTracked: row.complete,
      goalsAgainst: row.goalsAgainst,
      goalsAgainstAverage:
        row.complete && row.seconds > 0 ? (row.knownGoalsAgainst * 3600) / row.seconds : null,
    })),
  );

  protected keeperOptions(teamId: number) {
    return this.vm.rosterOptions(teamId).filter((row: any) => row.position === 'G');
  }
  protected hasKeeperIntervals(teamId: number): boolean {
    return this.vm.protocol().goalieShifts.some((row: any) => row.teamId === teamId);
  }
  protected wholeGame(teamId: number, playerId: number): void {
    const duration = this.keeperSummary().durationSeconds;
    if (duration === null || this.hasKeeperIntervals(teamId)) return;
    const key = teamId === this.vm.detail().match.homeTeamId ? 'homeRoster' : 'awayRoster';
    this.vm.patchProtocol(
      [key],
      this.vm
        .protocol()
        [
          key
        ].map((row: any) => (row.position === 'G' ? { ...row, played: row.playerId === playerId } : row)),
    );
    this.vm.patchProtocol(
      ['goalieShifts'],
      [
        ...this.vm.protocol().goalieShifts,
        {
          teamId,
          playerId,
          from: '00:00',
          to: formatGoalieTime(duration),
        },
      ],
    );
  }
  protected setGoalKeeper(goal: any, goalieId: number | null | undefined): void {
    const goalType =
      goalieId === null
        ? 'empty_net'
        : typeof goalieId === 'number' && goalContext(goal).goalType === 'empty_net'
          ? 'regular'
          : goalContext(goal).goalType;
    this.vm.patchProtocolItem(goal, {
      ...goalContextPatch(goal, { goalType }),
      goalieId: goalType === 'empty_net' ? null : goalieId,
    });
  }
  protected keeperAssignment(goalId: string): string {
    const assignment = this.keeperSummary().assignments.find((row) => row.goalId === goalId);
    if (assignment?.status === 'assigned') return this.vm.playerName(assignment.goalieId!);
    if (assignment?.status === 'empty_net') return 'Пустые ворота';
    return 'Уточните интервалы или вратаря';
  }

  protected addGoal() {
    this.vm.addGoal();
    afterNextRender(
      () => {
        this.goalList()?.nativeElement.querySelector<HTMLSelectElement>('select')?.focus();
      },
      { injector: this.injector },
    );
  }

  protected addPenalty(): void {
    this.vm.addPenalty();
    afterNextRender(
      () => {
        this.penaltyList()?.nativeElement.querySelector<HTMLSelectElement>('select')?.focus();
      },
      { injector: this.injector },
    );
  }
}
