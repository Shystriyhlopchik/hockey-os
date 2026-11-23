import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-player-link',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './player-link.html',
  styleUrl: './player-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerLink {
  readonly playerId = input<number | null | undefined>();
  readonly name = input.required<string>();
}
