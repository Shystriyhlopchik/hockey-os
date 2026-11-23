import { goalSituationLabel, penaltyStart } from '../../../../shared/protocol-details.js';
import { PlayerLink } from '../player-link/player-link';
import { OfficialCrew } from '../official-crew/official-crew';
import { goalieSummary, formatGoalieTime } from '../../../../shared/goalie-statistics.js';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { chronologicalGoals, sortRoster } from '../../features/protocol/protocol-order';
import { STAFF_FIELDS, periodSummary } from '../../features/protocol/protocol-sheet';
@Component({
  selector: 'app-protocol-sheet',
  standalone: true,
  imports: [PlayerLink, OfficialCrew],
  templateUrl: './protocol-sheet.html',
  styleUrl: './protocol-sheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolSheet {
  readonly isDraft = input(true);
  readonly protocol = input.required<any>();
  readonly match = input.required<any>();
  readonly tournament = input.required<any>();
  readonly teams = input<any[]>([]);
  readonly players = input<any[]>([]);
  readonly identities = input<any>({});
  protected readonly outcomes: Record<string, string> = {
    regulation: 'Основное время',
    draw: 'Ничья',
    overtime: 'Овертайм',
    shootout: 'Броски для определения победителя',
    technical: 'Технический результат',
  };
  protected readonly staffFields = STAFF_FIELDS;
  readonly summary = computed(() => {
    return periodSummary(this.protocol(), this.match(), this.tournament().rules);
  });
  readonly keepers = computed(() =>
    goalieSummary(this.protocol(), this.match(), this.tournament().rules),
  );
  readonly goalieTime = formatGoalieTime;
  team(id: number) {
    return this.teams().find((t) => t.id === id)?.name || '—';
  }
  name(id: number | null) {
    return this.identities()[id || 0]?.name || this.players().find((p) => p.id === id)?.name || '—';
  }
  number(id: number | null) {
    return (
      [...this.protocol().homeRoster, ...this.protocol().awayRoster].find((r) => r.playerId === id)
        ?.number ?? '—'
    );
  }
  protected readonly orderedGoals = computed(() => chronologicalGoals<any>(this.protocol().goals));
  readonly sides = computed(() => {
    return [
      {
        id: this.match().homeTeamId,
        key: 'homeRoster',
        roster: sortRoster<any>(this.protocol().homeRoster),
        staff: 'homeStaff',
        letter: 'А',
      },
      {
        id: this.match().awayTeamId,
        key: 'awayRoster',
        roster: sortRoster<any>(this.protocol().awayRoster),
        staff: 'awayStaff',
        letter: 'Б',
      },
    ];
  });
  readonly goalSituationLabel = goalSituationLabel;
  readonly penaltyStart = penaltyStart;
  onIce(ids: number[] | undefined) {
    return ids?.map((id) => this.number(id)).join(', ') || '—';
  }
  date(value: string | null) {
    return value
      ? new Date(value).toLocaleString('ru-RU', {
          timeZone: 'Europe/Moscow',
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : 'Не назначено';
  }
  actual(value: string) {
    return value ? value.replace('T', ' ') : '—';
  }
}
