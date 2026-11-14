import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-section-heading',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './section-heading.html',
  styleUrl: './section-heading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeading {
  readonly title = input.required<string>();
  readonly eyebrow = input('');
  readonly headingId = input('');
  readonly href = input('');
  readonly linkLabel = input('Подробнее');
}
