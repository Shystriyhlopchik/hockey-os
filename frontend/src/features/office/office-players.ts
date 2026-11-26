import { PlayerAvatar } from '../../components/player-avatar/player-avatar';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-players',
  standalone: true,
  imports: [PlayerAvatar, FormsModule],
  templateUrl: './office-players.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficePlayers {
  protected readonly vm = inject(LEAGUE_STATE);
}
