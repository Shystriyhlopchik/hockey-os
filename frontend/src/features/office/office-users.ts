import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-users',
  standalone: true,
  imports: [],
  templateUrl: './office-users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeUsers {
  protected readonly vm = inject(LEAGUE_STATE);
}
