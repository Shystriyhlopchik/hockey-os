import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-audit',
  standalone: true,
  imports: [],
  templateUrl: './office-audit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeAudit {
  protected readonly vm = inject(LEAGUE_STATE);
}
