import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { LeagueMatch } from '../../core/models/league';
import { scheduleStatus } from '../../features/calendar/schedule-status';
@Component({
  selector: 'app-schedule-status',
  standalone: true,
  templateUrl: './schedule-status.html',
  styleUrl: './schedule-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleStatus {
  readonly match = input.required<LeagueMatch>();
  protected readonly label = computed(() => scheduleStatus(this.match()));
}
