import { TeamBadge } from '../../components/team-badge/team-badge';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProtocolSheet } from '../../components/protocol-sheet/protocol-sheet';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-protocol',
  standalone: true,
  imports: [TeamBadge, FormsModule, RouterLink, ProtocolSheet],
  templateUrl: './office-protocol.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeProtocol {
  protected readonly vm = inject(LEAGUE_STATE);
}
