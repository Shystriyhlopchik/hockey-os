import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerStat } from '../../core/models/league';
import { formatGoalieTime } from '../../../../shared/goalie-statistics.js';

@Component({
  selector: 'app-goalie-table',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './goalie-table.html',
  styleUrl: './goalie-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalieTable {
  readonly rows = input.required<readonly PlayerStat[]>();
  readonly teams = input<readonly { id: number; name: string }[]>([]);
  readonly tournaments = input<readonly { id: number; name: string }[]>([]);
  readonly linkPlayers = input(true);
  protected readonly time = formatGoalieTime;
  protected readonly displayRows = computed(() =>
    [...this.rows()]
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map((row) => ({
        ...row,
        teamName: this.teams().find((team) => team.id === row.teamId)?.name || '',
        tournamentName:
          this.tournaments().find((tournament) => tournament.id === row.tournamentId)?.name || '',
      })),
  );
  protected average(value: number | null | undefined): string {
    return value == null
      ? '—'
      : value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
