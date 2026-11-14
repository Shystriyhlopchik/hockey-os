import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Team } from '../../core/models/league';
@Component({
  selector: 'app-team-badge',
  standalone: true,
  templateUrl: './team-badge.html',
  styleUrl: './team-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamBadge {
  readonly team = input<Partial<Team> | null>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  protected readonly initials = computed(() => this.team()?.abbreviation || 'ХК');
}
