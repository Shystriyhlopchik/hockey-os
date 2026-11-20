import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Partner } from './partner';

@Component({
  selector: 'app-partner-showcase',
  standalone: true,
  templateUrl: './partner-showcase.html',
  styleUrl: './partner-showcase.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerShowcase {
  readonly partners = input.required<readonly Partner[]>();
  readonly headingId = input('partners-title');
  private readonly selectedId = signal('');
  protected readonly storyId = computed(() => `${this.headingId()}-story`);
  protected readonly selected = computed(
    () => this.partners().find((partner) => partner.id === this.selectedId()) ?? this.partners()[0],
  );

  protected selectPartner(id: string): void {
    this.selectedId.set(id);
  }
}
