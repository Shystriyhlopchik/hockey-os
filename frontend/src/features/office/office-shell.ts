import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-shell',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterOutlet],
  templateUrl: './office-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeShell {
  protected readonly vm = inject(LEAGUE_STATE);
}
