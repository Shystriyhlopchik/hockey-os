import { DialogFocus } from '../../components/dialog-focus/dialog-focus';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-dialog-outlet',
  standalone: true,
  imports: [DialogFocus, FormsModule, RouterLink],
  templateUrl: './dialog-outlet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogOutlet {
  protected readonly vm = inject(LEAGUE_STATE);
}
