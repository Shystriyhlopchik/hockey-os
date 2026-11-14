import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-players-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './players-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
