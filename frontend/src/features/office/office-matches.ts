import { ScheduleStatus } from '../../components/schedule-status/schedule-status';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
@Component({
  selector: 'app-office-matches',
  standalone: true,
  imports: [FormsModule, RouterLink, ScheduleStatus],
  templateUrl: './office-matches.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeMatches {
  protected readonly vm = inject(LEAGUE_STATE);
}
