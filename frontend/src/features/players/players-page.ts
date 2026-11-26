import { PlayerAvatar } from '../../components/player-avatar/player-avatar';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
import { GoalieTable } from '../../components/goalie-table/goalie-table';
@Component({
  selector: 'app-players-page',
  standalone: true,
  imports: [PlayerAvatar, FormsModule, RouterLink, GoalieTable],
  templateUrl: './players-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersPage {
  protected readonly vm = inject(LEAGUE_STATE);
  protected readonly view = signal<'skaters' | 'goalies'>('skaters');
  protected readonly skaters = computed(() =>
    this.vm.stats().filter((row: any) => row.position !== 'G'),
  );
  protected readonly goalies = computed(() =>
    this.vm
      .tournamentStats()
      .filter(
        (row: any) =>
          row.position === 'G' &&
          (!this.vm.teamFilter() || row.teamId === this.vm.teamFilter()) &&
          row.name.toLowerCase().includes(this.vm.search().toLowerCase()),
      ),
  );
  protected readonly playerGoalies = computed(() =>
    this.vm.data().stats.filter((row) => row.playerId === this.vm.player()?.id),
  );
}
