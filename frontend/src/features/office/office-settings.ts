import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-settings',
  standalone: true,
  imports: [],
  templateUrl: './office-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeSettings {
  protected readonly vm = inject(LEAGUE_STATE);
}
