import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
@Component({
  selector: 'app-player-avatar',
  standalone: true,
  templateUrl: './player-avatar.html',
  styleUrl: './player-avatar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerAvatar {
  readonly name = input.required<string>();
  readonly photoUrl = input<string | null | undefined>(null);
  readonly size = input<'sm' | 'md' | 'lg' | 'feature'>('md');
  protected readonly failedUrl = signal<string | null | undefined>(undefined);
  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join(''),
  );
}
