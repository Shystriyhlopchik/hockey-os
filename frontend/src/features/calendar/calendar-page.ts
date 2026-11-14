import { MatchRow } from '../../components/match-row/match-row';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [MatchRow, FormsModule],
  templateUrl: './calendar-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  protected readonly vm = inject(LEAGUE_STATE);
}
