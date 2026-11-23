import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { officialCrew } from '../../../../shared/protocol-details.js';
@Component({
  selector: 'app-official-crew',
  standalone: true,
  templateUrl: './official-crew.html',
  styleUrl: './official-crew.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialCrew {
  readonly protocol = input.required<any>();
  protected readonly crew = computed(() => officialCrew(this.protocol()));
}
