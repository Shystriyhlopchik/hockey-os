import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TeamBadge } from '../../components/team-badge/team-badge';
import { ProtocolSheet } from '../../components/protocol-sheet/protocol-sheet';
import { LEAGUE_STATE } from '../../core/state/league-state';
import { newestGoalEntries } from './protocol-order';

@Component({
  selector: 'app-office-protocol',
  standalone: true,
  imports: [TeamBadge, FormsModule, RouterLink, ProtocolSheet],
  templateUrl: './office-protocol.html',
  styleUrl: './office-protocol.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeProtocol {
  protected readonly vm = inject(LEAGUE_STATE);
  private readonly injector = inject(Injector);
  private readonly goalList = viewChild<ElementRef<HTMLElement>>('goalList');
  protected readonly goals = computed(() =>
    newestGoalEntries<any>(this.vm.protocol()?.goals || []),
  );

  protected addGoal() {
    this.vm.addGoal();
    afterNextRender(
      () => {
        this.goalList()?.nativeElement.querySelector<HTMLSelectElement>('select')?.focus();
      },
      { injector: this.injector },
    );
  }
}
